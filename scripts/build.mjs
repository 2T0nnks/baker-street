#!/usr/bin/env node
/**
 * build.mjs — the whole engine in one HTML file.
 *
 * Reads every JSON in cases/ and injects each as a
 *   <script type="application/json" data-case="slug">…</script>
 * block into engine/template.html at the <!-- CASES:INJECT --> marker.
 *
 * Output: dist/index.html — a single, standalone file. No runtime deps.
 * That is the file GitHub Pages serves.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TEMPLATE = path.join(ROOT, "engine", "template.html");
const CASES_DIR = path.join(ROOT, "cases");
const DIST_DIR = path.join(ROOT, "dist");
const OUT = path.join(DIST_DIR, "index.html");
const MARKER = "<!-- CASES:INJECT -->";

function escapeForScript(json) {
  // <script type="application/json"> is CDATA-ish; </script> anywhere in the
  // JSON string would end the block. Escape defensively.
  return json.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
}

async function readAllCases() {
  const files = (await fs.readdir(CASES_DIR)).filter(f => f.endsWith(".json"));
  const cases = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(CASES_DIR, file), "utf-8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Invalid JSON in cases/${file}: ${e.message}`);
    }
    if (!data.slug) throw new Error(`Missing "slug" in cases/${file}`);
    const expected = file.replace(/\.json$/, "");
    if (data.slug !== expected) {
      throw new Error(`Slug mismatch: cases/${file} has slug "${data.slug}" — filename must match slug.`);
    }
    cases.push({ file, data });
  }
  return cases;
}

async function main() {
  const template = await fs.readFile(TEMPLATE, "utf-8");
  if (!template.includes(MARKER)) {
    throw new Error(`Template is missing marker ${MARKER}`);
  }

  const cases = await readAllCases();
  console.log(`build: found ${cases.length} case(s)`);

  const injected = cases
    .map(({ data }) => {
      const compact = JSON.stringify(data);
      return `<script type="application/json" data-case="${data.slug}">${escapeForScript(compact)}</script>`;
    })
    .join("\n");

  const output = template.replace(MARKER, injected);

  await fs.mkdir(DIST_DIR, { recursive: true });
  await fs.writeFile(OUT, output, "utf-8");

  const bytes = (await fs.stat(OUT)).size;
  console.log(`build: wrote ${OUT} (${(bytes / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error("build failed:", err.message);
  process.exit(1);
});
