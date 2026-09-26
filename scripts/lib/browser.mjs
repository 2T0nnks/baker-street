/**
 * browser.mjs — what check-layout.mjs and og-images.mjs share: a static
 * server for dist/ and a headless Chrome/Edge driven over the DevTools
 * protocol with Node's built-in WebSocket (no dependencies).
 */

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..", "..");
export const DIST = path.join(ROOT, "dist");

export const sleep = ms => new Promise(r => setTimeout(r, ms));

const BROWSERS = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

export function openCases() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) throw new Error("dist/index.html not found — run `npm run build` first.");
  return fs.readdirSync(path.join(ROOT, "cases"))
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(ROOT, "cases", f), "utf8")))
    .filter(c => c.status === "open");
}

// Serves dist/ on a free local port. Returns { server, base }.
export function serveDist() {
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
  return new Promise(r => server.listen(0, "127.0.0.1", () => r({ server, base: `http://127.0.0.1:${server.address().port}/` })));
}

const freePort = () => new Promise(r => {
  const s = http.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); });
});

// Starts a headless browser and connects to its first tab.
// Returns a page handle: { send, js, on, goto, close }.
export async function openBrowser() {
  const exe = BROWSERS.find(p => fs.existsSync(p));
  if (!exe) throw new Error("Chrome/Edge not found. Set CHROME_PATH.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "adler-browser-"));
  const port = await freePort();
  const args = ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank"];
  // GitHub's Linux runners don't allow Chrome's sandbox; the pages are our own build.
  if (process.platform === "linux") args.unshift("--no-sandbox");
  const proc = spawn(exe, args, { stdio: "ignore" });

  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = list.find(t => t.type === "page")?.webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) { proc.kill(); throw new Error("browser did not start"); }

  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) listeners.forEach(fn => fn(m));
  });
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const on = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  const js = async expr => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "evaluate failed");
    return r.result?.result?.value;
  };
  const goto = async url => {
    let off;
    const loaded = new Promise(r => { off = on(m => { if (m.method === "Page.loadEventFired") r(); }); });
    await send("Page.navigate", { url });
    await loaded;
    off();
  };
  const close = async () => {
    ws.close();
    proc.kill();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  await send("Page.enable");
  await send("Runtime.enable");
  return { send, js, on, goto, close };
}

// An expression that resolves true once `cond` holds, or false after `ms`.
export const waitFor = (cond, ms) =>
  `(async () => { const t = Date.now(); while (!(${cond})) { if (Date.now() - t > ${ms}) return false; await new Promise(r => setTimeout(r, 100)); } return true; })()`;
