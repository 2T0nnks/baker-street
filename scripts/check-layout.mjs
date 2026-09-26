#!/usr/bin/env node
/**
 * check-layout.mjs — opens every open case in a headless browser, at a few
 * screen widths, and fails if the diagrams have anything overlapping.
 *
 * It is the same report as ?debug=layout (the engine prints each problem as
 * a "[Adler layout]" console warning), run for the flow and for the risk map,
 * plus any JavaScript error on the page. Run `npm run build` first.
 *
 * No dependencies: talks to Chrome or Edge over the DevTools protocol with
 * Node's built-in WebSocket. Set CHROME_PATH if the browser isn't found.
 */

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const WIDTHS = [
  { name: "desktop", width: 1280, height: 900, mobile: false },
  { name: "notebook", width: 1024, height: 768, mobile: false },
  { name: "celular", width: 390, height: 844, mobile: true },
];

const BROWSERS = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function openCases() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) throw new Error("dist/index.html not found — run `npm run build` first.");
  return fs.readdirSync(path.join(ROOT, "cases"))
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(ROOT, "cases", f), "utf8")))
    .filter(c => c.status === "open")
    .map(c => c.slug);
}

function serve() {
  const types = { ".html": "text/html; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/+/, "");
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(DIST, rel);
    if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end("not found");
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}

async function launch() {
  const exe = BROWSERS.find(p => fs.existsSync(p));
  if (!exe) throw new Error("Chrome/Edge not found. Set CHROME_PATH.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "adler-layout-"));
  const port = await new Promise(r => {
    const s = http.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
  });
  const args = ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank"];
  // GitHub's Linux runners don't allow Chrome's sandbox; the page is our own build.
  if (process.platform === "linux") args.unshift("--no-sandbox");
  const proc = spawn(exe, args, { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find(t => t.type === "page");
      if (page) return { proc, profile, pageWs: page.webSocketDebuggerUrl };
    } catch {}
    await sleep(200);
  }
  throw new Error("browser did not start");
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) listeners.forEach(fn => fn(m));
  });
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const js = async expr => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "evaluate failed");
    return r.result?.result?.value;
  };
  return new Promise(r => ws.addEventListener("open", () => r({ ws, send, js, on: fn => listeners.push(fn) }), { once: true }));
}

// Runs in the page: go to the flow, wait for the intro, then reveal and open the risk map.
const WAIT = (cond, ms) => `(async () => { const t = Date.now(); while (!(${cond})) { if (Date.now() - t > ${ms}) return false; await new Promise(r => setTimeout(r, 100)); } return true; })()`;

async function run() {
  const cases = openCases();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const { proc, profile, pageWs } = await launch();
  const cdp = await connect(pageWs);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  let current = null;
  cdp.on(m => {
    if (!current) return;
    if (m.method === "Runtime.consoleAPICalled") {
      const text = (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ");
      const hit = text.match(/^\[Adler layout\] (\S+): (.*)$/);
      if (hit) current.issues.add(`${hit[1]}: ${hit[2]}`);
      else if (m.params.type === "error") current.issues.add(`console.error: ${text}`);
    }
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      current.issues.add(`erro de JavaScript: ${d.exception?.description || d.text}`);
    }
  });

  let failed = 0;
  for (const view of WIDTHS) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: view.width, height: view.height, deviceScaleFactor: 1, mobile: view.mobile });
    for (const slug of cases) {
      current = { issues: new Set() };
      const loaded = new Promise(r => cdp.on(m => { if (m.method === "Page.loadEventFired") r(); }));
      await cdp.send("Page.navigate", { url: `${base}?caso=${slug}&debug=layout` });
      await loaded;
      try {
        await cdp.js(`localStorage.clear(); window.confirm = () => true; document.querySelectorAll(".progress-cell")[1].click(); true`);
        if (!await cdp.js(WAIT(`document.getElementById("flowWrap")._played`, 20000))) current.issues.add("flowWrap: a animação do fluxo não terminou");
        await sleep(300);
        await cdp.js(`document.querySelectorAll(".progress-cell")[2].click();
          [...document.querySelectorAll("#checkList input[data-cand]")].slice(0, 3).forEach(i => i.click());
          document.getElementById("revealBtn").click(); true`);
        if (!await cdp.js(WAIT(`document.querySelector("#riskMap .pin")`, 10000))) current.issues.add("riskMap: o mapa de riscos não desenhou os pinos");
        await sleep(300);
        const reports = await cdp.js(`[...document.querySelectorAll(".layout-debug strong")].map(s => s.textContent)`);
        for (const id of ["flowWrap", "riskMap"]) {
          if (!reports.some(r => r.includes(id))) current.issues.add(`${id}: o relatório de layout não rodou`);
        }
      } catch (e) {
        current.issues.add(`falhou ao abrir o caso: ${e.message}`);
      }
      const label = `${slug} @ ${view.name} (${view.width}px)`;
      if (current.issues.size) {
        failed++;
        console.log(`✗ ${label}`);
        current.issues.forEach(i => console.log(`    ${i}`));
      } else {
        console.log(`✓ ${label}`);
      }
    }
  }

  current = null;
  cdp.ws.close();
  proc.kill();
  server.close();
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}

  const total = cases.length * WIDTHS.length;
  if (failed) {
    console.log(`\n${failed} de ${total} verificações com problema. Abra o caso com ?debug=layout para ver onde.`);
    process.exit(1);
  }
  console.log(`\nLayout ok: ${cases.length} casos × ${WIDTHS.length} larguras, sem sobreposições nem erros.`);
}

run().catch(e => { console.error(e.message); process.exit(1); });
