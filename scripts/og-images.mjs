#!/usr/bin/env node
/**
 * og-images.mjs — the preview images shown when someone shares a link to
 * the site or to a case (Slack, WhatsApp, LinkedIn…). Run after `npm run build`.
 *
 * For each open case it photographs the case's own flow diagram from the
 * built site and composes it into a 1200×630 card with the title, subtitle,
 * sector, difficulty and duration. Output: dist/og/<slug>.png, plus
 * dist/og/adler.png for the home page.
 *
 * Uses the installed Chrome or Edge; set CHROME_PATH if it isn't found.
 */

import fs from "node:fs";
import path from "node:path";
import { DIST, openCases, serveDist, openBrowser, waitFor, sleep } from "./lib/browser.mjs";

const OUT = path.join(DIST, "og");
const W = 1200, H = 630;
const SECTOR = { fintech: "Fintech", healthtech: "Saúde", edtech: "Educação", govtech: "Serviço público" };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const strip = s => String(s).replace(/<[^>]+>/g, "");

// The card, in the site's dark palette and fonts (served from dist/fonts).
function card(base, { eyebrow, title, subtitle, chips, image }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Fraunces"; font-weight: 100 900; src: url(${base}fonts/fraunces-latin-full-normal.woff2) format("woff2-variations"); }
@font-face { font-family: "IBM Plex Sans"; font-weight: 400; src: url(${base}fonts/ibm-plex-sans-latin-400-normal.woff2) format("woff2"); }
@font-face { font-family: "IBM Plex Sans"; font-weight: 500; src: url(${base}fonts/ibm-plex-sans-latin-500-normal.woff2) format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 500; src: url(${base}fonts/jetbrains-mono-latin-500-normal.woff2) format("woff2"); }
* { box-sizing: border-box; }
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
body { background: #141310; color: #E7E1D3; font-family: "IBM Plex Sans", sans-serif; display: grid; grid-template-columns: 430px 1fr; }
.text { padding: 64px 0 56px 64px; display: flex; flex-direction: column; }
.eyebrow { font: 500 15px/1 "JetBrains Mono", monospace; letter-spacing: 0.16em; text-transform: uppercase; color: #B7C495; display: flex; align-items: center; gap: 12px; }
.eyebrow i { width: 12px; height: 12px; border-radius: 50%; background: #8FA168; }
h1 { font-family: "Fraunces", serif; font-weight: 600; font-size: 66px; line-height: 1.02; letter-spacing: -0.02em; margin: 34px 0 20px; }
p { font-size: 23px; line-height: 1.4; color: #C4BDA8; margin: 0; }
.chips { margin-top: auto; display: flex; gap: 10px; flex-wrap: wrap; }
.chips span { font: 500 15px/1 "JetBrains Mono", monospace; padding: 9px 13px; border: 1px solid #3A352B; border-radius: 3px; color: #C4BDA8; }
.art { display: flex; align-items: center; justify-content: center; padding: 36px 36px 36px 24px; }
.art img { max-width: 100%; max-height: 100%; border-radius: 8px; border: 1px solid #2C2820; background: #1F1C17; }
.art.bare img { border: 0; background: none; }
</style></head><body>
<div class="text">
  <div class="eyebrow"><i></i>${esc(eyebrow)}</div>
  <h1>${esc(title)}</h1>
  <p>${esc(subtitle)}</p>
  <div class="chips">${chips.filter(Boolean).map(c => `<span>${esc(c)}</span>`).join("")}</div>
</div>
<div class="art${image.bare ? " bare" : ""}"><img src="${image.src}" alt=""></div>
</body></html>`;
}

async function shoot(page, selector, pad = 0) {
  const clip = await page.js(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: r.left + scrollX - ${pad}, y: r.top + scrollY - ${pad}, width: r.width + ${pad * 2}, height: r.height + ${pad * 2}, scale: 1 }; })()`);
  const r = await page.send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
  return `data:image/png;base64,${r.result.data}`;
}

async function compose(page, base, file, data) {
  await page.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await page.goto(`${base}og/__card__`); // any same-origin URL, so the fonts load
  const { result } = await page.send("Page.getFrameTree");
  await page.send("Page.setDocumentContent", { frameId: result.frameTree.frame.id, html: card(base, data) });
  await page.js(`document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.decode()))).then(() => true)`);
  const r = await page.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(r.result.data, "base64"));
  console.log(`og: ${file}`);
}

async function run() {
  const cases = openCases();
  fs.mkdirSync(OUT, { recursive: true });
  const { server, base } = await serveDist();
  const page = await openBrowser();

  // Photos are taken at 2× so they stay sharp when scaled into the card.
  const site = () => page.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false });

  await site();
  await page.goto(base);
  await page.js(`localStorage.clear(); localStorage.setItem("adler_theme", "dark"); true`);
  await page.goto(base);
  await sleep(2600); // the hero illustration draws itself
  const hero = await shoot(page, "#view-landing .trail-illo");
  await compose(page, base, "adler.png", {
    eyebrow: "Adler · open source",
    title: "Onde a segurança começa.",
    subtitle: "Treino de leitura de casos de abuso em fluxos reais, antes do primeiro commit.",
    chips: [`${cases.length} casos`, "threat model"],
    image: { src: hero, bare: true },
  });

  for (const c of cases) {
    await site();
    await page.goto(`${base}?caso=${c.slug}`);
    await page.js(`document.querySelectorAll(".progress-cell")[1].click(); true`);
    if (!await page.js(waitFor(`document.getElementById("flowWrap")._played`, 20000))) throw new Error(`${c.slug}: flow did not finish drawing`);
    // No moving packets in a still image.
    await page.js(`document.querySelectorAll("#flowWrap .packet, #flowWrap animateMotion").forEach(e => e.remove()); true`);
    await sleep(200);
    const flow = await shoot(page, "#flowWrap", 12);
    await compose(page, base, `${c.slug}.png`, {
      eyebrow: "Adler · caso de abuso",
      title: strip(c.title),
      subtitle: strip(c.subtitle),
      chips: [SECTOR[c.domain] || c.domain, c.difficulty, c.duration],
      image: { src: flow },
    });
  }

  await page.close();
  server.close();
}

run().catch(e => { console.error("og-images failed:", e.message); process.exit(1); });
