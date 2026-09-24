#!/usr/bin/env node
/**
 * build.mjs — the whole engine in one HTML file.
 *
 * Reads every JSON in cases/ and injects each as a
 *   <script type="application/json" data-case="slug">…</script>
 * block into engine/template.html at the <!-- CASES:INJECT --> marker.
 *
 * Output: dist/index.html plus dist/fonts/ (self-hosted fonts). No runtime
 * deps and no third-party requests. That is what GitHub Pages serves.
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
const FONTS_DIR = path.join(DIST_DIR, "fonts");

// Self-hosted fonts (no third-party requests from visitors). Each package ships
// under the SIL OFL, which travels with the files.
const FONTS = [
  ["@fontsource-variable/fraunces", ["fraunces-latin-full-normal.woff2"]],
  ["@fontsource/ibm-plex-sans", ["300", "400", "500", "600"].map(w => `ibm-plex-sans-latin-${w}-normal.woff2`)],
  ["@fontsource/jetbrains-mono", ["400", "500"].map(w => `jetbrains-mono-latin-${w}-normal.woff2`)],
];

async function copyFonts() {
  await fs.mkdir(FONTS_DIR, { recursive: true });
  for (const [pkg, files] of FONTS) {
    const dir = path.join(ROOT, "node_modules", pkg);
    for (const file of files) {
      await fs.copyFile(path.join(dir, "files", file), path.join(FONTS_DIR, file));
    }
    await fs.copyFile(path.join(dir, "LICENSE"), path.join(FONTS_DIR, `LICENSE-${path.basename(pkg)}.txt`));
  }
}

// Content-Security-Policy is set in a <meta> tag; inline scripts are allowed
// only by hash, computed here from the final output.
async function scriptHashes(html) {
  const { createHash } = await import("node:crypto");
  const hashes = [];
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    // Browsers hash the script after normalizing newlines to LF, so a CRLF
    // checkout (Windows) must be normalized the same way.
    const text = m[1].replace(/\r\n?/g, "\n");
    hashes.push(`'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`);
  }
  if (hashes.length === 0) throw new Error("No inline <script> found to hash for the CSP");
  return hashes.join(" ");
}

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

  const all = await readAllCases();
  // Drafts never ship: everything injected here is public in dist/index.html.
  const cases = all.filter(({ data }) => data.status !== "draft");
  const drafts = all.length - cases.length;
  console.log(`build: found ${all.length} case(s)${drafts ? `, skipping ${drafts} draft(s)` : ""}`);

  const injected = cases
    .map(({ data }) => {
      const compact = JSON.stringify(data);
      return `<script type="application/json" data-case="${data.slug}">${escapeForScript(compact)}</script>`;
    })
    .join("\n");

  let output = template.replace(MARKER, injected);
  if (!output.includes("__CSP_SCRIPT_HASHES__")) {
    throw new Error("Template is missing the __CSP_SCRIPT_HASHES__ placeholder");
  }
  output = output.replace("__CSP_SCRIPT_HASHES__", await scriptHashes(output));

  await fs.mkdir(DIST_DIR, { recursive: true });
  await fs.writeFile(OUT, output, "utf-8");
  await copyFonts();

  const bytes = (await fs.stat(OUT)).size;
  console.log(`build: wrote ${OUT} (${(bytes / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error("build failed:", err.message);
  process.exit(1);
});
