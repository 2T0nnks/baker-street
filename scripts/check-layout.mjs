#!/usr/bin/env node
/**
 * check-layout.mjs — opens every open case in a headless browser, at a few
 * screen widths, and fails if the diagrams have anything overlapping.
 *
 * It is the same report as ?debug=layout (the engine prints each problem as
 * a "[Adler layout]" console warning), run for the flow and for the risk map,
 * plus any JavaScript error on the page — in every language the build made,
 * since translated labels have other lengths. Run `npm run build` first.
 *
 * Uses the installed Chrome or Edge; set CHROME_PATH if it isn't found.
 */

import { sites, serveDist, openBrowser, waitFor, sleep } from "./lib/browser.mjs";

const WIDTHS = [
  { name: "desktop", width: 1280, height: 900, mobile: false },
  { name: "notebook", width: 1024, height: 768, mobile: false },
  { name: "celular", width: 390, height: 844, mobile: true },
];

async function run() {
  const all = sites();
  const { server, base } = await serveDist();
  const page = await openBrowser();

  let current = null;
  page.on(m => {
    if (!current) return;
    if (m.method === "Runtime.consoleAPICalled") {
      const text = (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ");
      const hit = text.match(/^\[Adler layout\] (\S+): (.*)$/);
      if (hit) current.add(`${hit[1]}: ${hit[2]}`);
      else if (m.params.type === "error") current.add(`console.error: ${text}`);
    }
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      current.add(`erro de JavaScript: ${d.exception?.description || d.text}`);
    }
  });

  let failed = 0, total = 0;
  for (const site of all) for (const view of WIDTHS) {
    await page.send("Emulation.setDeviceMetricsOverride", { width: view.width, height: view.height, deviceScaleFactor: 1, mobile: view.mobile });
    for (const { slug } of site.cases) {
      current = new Set();
      total++;
      try {
        await page.goto(`${base}${site.path}?caso=${slug}&debug=layout`);
        // Flow stage: wait for the intro animation to finish.
        await page.js(`localStorage.clear(); window.confirm = () => true; document.querySelectorAll(".progress-cell")[1].click(); true`);
        if (!await page.js(waitFor(`document.getElementById("flowWrap")._played`, 20000))) current.add("flowWrap: a animação do fluxo não terminou");
        await sleep(300);
        // Reveal with a few items marked, so the risk map draws caught and missed pins.
        await page.js(`document.querySelectorAll(".progress-cell")[2].click();
          [...document.querySelectorAll("#checkList input[data-cand]")].slice(0, 3).forEach(i => i.click());
          document.getElementById("revealBtn").click(); true`);
        if (!await page.js(waitFor(`document.querySelector("#riskMap .pin")`, 10000))) current.add("riskMap: o mapa de riscos não desenhou os pinos");
        await sleep(300);
        const reports = await page.js(`[...document.querySelectorAll(".layout-debug strong")].map(s => s.textContent)`);
        for (const id of ["flowWrap", "riskMap"]) {
          if (!reports.some(r => r.includes(id))) current.add(`${id}: o relatório de layout não rodou`);
        }
      } catch (e) {
        current.add(`falhou ao abrir o caso: ${e.message}`);
      }
      const label = `${site.path ? `[${site.lang}] ` : ""}${slug} @ ${view.name} (${view.width}px)`;
      if (current.size) {
        failed++;
        console.log(`✗ ${label}`);
        current.forEach(i => console.log(`    ${i}`));
      } else {
        console.log(`✓ ${label}`);
      }
    }
  }

  current = null;
  await page.close();
  server.close();

  if (failed) {
    console.log(`\n${failed} de ${total} verificações com problema. Abra o caso com ?debug=layout para ver onde.`);
    process.exit(1);
  }
  console.log(`\nLayout ok: ${total} verificações (${all.map(s => `${s.lang}: ${s.cases.length} casos`).join(", ")}; ${WIDTHS.length} larguras), sem sobreposições nem erros.`);
}

run().catch(e => { console.error(e.message); process.exit(1); });
