#!/usr/bin/env node
/**
 * build.mjs — the whole engine in one HTML file, once per language.
 *
 * Reads every JSON in cases/ and injects each as a
 *   <script type="application/json" data-case="slug">…</script>
 * block into engine/template.html at the <!-- CASES:INJECT --> marker.
 *
 * Portuguese is the source. Each engine/i18n/<lang>.json turns the template
 * into another language (pairs of Portuguese → translated text) and the
 * build takes that language's cases from cases/<lang>/ — only the ones
 * translated so far, which must mirror the Portuguese case (validate.mjs).
 *
 * Output: dist/index.html, dist/<lang>/index.html, a small page per open
 * case at caso/<slug>/ (share previews) and dist/fonts/ (self-hosted fonts).
 * No runtime deps and no third-party requests. That is what GitHub Pages serves.
 */

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TEMPLATE = path.join(ROOT, "engine", "template.html");
const I18N_DIR = path.join(ROOT, "engine", "i18n");
const CASES_DIR = path.join(ROOT, "cases");
const DIST_DIR = path.join(ROOT, "dist");
const MARKER = "<!-- CASES:INJECT -->";
const FONTS_DIR = path.join(DIST_DIR, "fonts");
// Public address of the site, for canonical links and share previews.
const SITE_URL = (process.env.SITE_URL || "https://2t0nnks.github.io/baker-street/").replace(/\/?$/, "/");

// The source language. Other languages come from engine/i18n/*.json.
const PORTUGUESE = {
  lang: "pt-BR",
  path: "",
  alt: { href: "en/", lang: "en", label: "EN", title: "English version" },
  casePage: { opening: "Abrindo", flowAlt: "Fluxo do caso" },
  pairs: [],
};

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

const escapeAttr = s => String(s).replace(/<[^>]+>/g, "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// One small page per open case at caso/<slug>/, so a shared link shows that
// case's title, subtitle and image (og/<slug>.png, made by og-images.mjs).
// Visitors are sent straight on to the case in the app.
function casePage(c, loc) {
  const base = SITE_URL + loc.path;
  const url = `${base}caso/${c.slug}/`;
  const app = `../../?caso=${encodeURIComponent(c.slug)}`;
  const title = `${escapeAttr(c.title)} · Adler`;
  const desc = escapeAttr(c.subtitle);
  return `<!doctype html>
<html lang="${loc.lang}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Adler">
<meta property="og:locale" content="${loc.lang.replace("-", "_")}">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${base}og/${c.slug}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${loc.casePage.flowAlt}: ${escapeAttr(c.title)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${app}">
<style>body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #EFEBE1; color: #1A1613; font: 16px/1.5 system-ui, sans-serif; } a { color: #4C5C34; } @media (prefers-color-scheme: dark) { body { background: #141310; color: #E7E1D3; } a { color: #B7C495; } }</style>
<p>${loc.casePage.opening} <a href="${app}">${escapeAttr(c.title)}</a>…</p>
</html>
`;
}

function escapeForScript(json) {
  // <script type="application/json"> is CDATA-ish; </script> anywhere in the
  // JSON string would end the block. Escape defensively.
  return json.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
}

async function readCases(dir, label) {
  if (!existsSync(dir)) return [];
  const files = (await fs.readdir(dir)).filter(f => f.endsWith(".json"));
  const cases = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(dir, file), "utf-8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Invalid JSON in ${label}${file}: ${e.message}`);
    }
    if (!data.slug) throw new Error(`Missing "slug" in ${label}${file}`);
    const expected = file.replace(/\.json$/, "");
    if (data.slug !== expected) {
      throw new Error(`Slug mismatch: ${label}${file} has slug "${data.slug}" — filename must match slug.`);
    }
    cases.push(data);
  }
  return cases;
}

async function locales() {
  const out = [PORTUGUESE];
  if (!existsSync(I18N_DIR)) return out;
  for (const file of (await fs.readdir(I18N_DIR)).filter(f => f.endsWith(".json")).sort()) {
    const loc = JSON.parse(await fs.readFile(path.join(I18N_DIR, file), "utf-8"));
    loc.code = file.replace(/\.json$/, "");
    out.push(loc);
  }
  return out;
}

// Portuguese template → another language. Every pair must still match the
// template, so a changed Portuguese text can't silently stay untranslated.
function translate(template, loc) {
  let out = template;
  const stale = [];
  for (const [from, to] of loc.pairs) {
    if (!out.includes(from)) { stale.push(from); continue; }
    out = out.replaceAll(from, to);
  }
  if (stale.length) {
    throw new Error(`engine/i18n/${loc.code}.json: ${stale.length} text(s) no longer in the template:\n  - ` +
      stale.map(s => s.length > 90 ? s.slice(0, 90) + "…" : s).join("\n  - "));
  }
  if (loc.nodeTech) {
    const start = out.indexOf("const NODE_TECH = {");
    const end = out.indexOf("};", start);
    let block = out.slice(start, end);
    for (const [key, text] of Object.entries(loc.nodeTech)) {
      const re = new RegExp(`^(\\s+${key}: )".*"(,?)\\r?$`, "m");
      if (!re.test(block)) throw new Error(`engine/i18n/${loc.code}.json: NODE_TECH has no "${key}"`);
      block = block.replace(re, (m, a, b) => `${a}${JSON.stringify(text)}${b}`);
    }
    out = out.slice(0, start) + block + out.slice(end);
  }
  return out;
}

async function main() {
  const template = await fs.readFile(TEMPLATE, "utf-8");
  if (!template.includes(MARKER)) {
    throw new Error(`Template is missing marker ${MARKER}`);
  }
  if (!template.includes("__CSP_SCRIPT_HASHES__")) {
    throw new Error("Template is missing the __CSP_SCRIPT_HASHES__ placeholder");
  }

  // Every icon the schema allows must be drawn by the engine.
  const schema = JSON.parse(await fs.readFile(path.join(ROOT, "schema", "case.schema.json"), "utf-8"));
  const allowed = schema.properties.flow.properties.nodes.items.properties.icon.enum;
  const iconsBlock = template.slice(template.indexOf("const NODE_ICONS = {"), template.indexOf("const iconSvg"));
  const drawn = [...iconsBlock.matchAll(/^\s+(\w+):\s+\["/gm)].map(m => m[1]);
  const missing = allowed.filter(k => !drawn.includes(k));
  if (missing.length) throw new Error(`engine/template.html has no NODE_ICONS entry for: ${missing.join(", ")}`);
  const techBlock = template.slice(template.indexOf("const NODE_TECH = {"), template.indexOf("const iconSvg"));
  const explained = [...techBlock.matchAll(/^\s+(\w+):\s+"/gm)].map(m => m[1]);
  const unexplained = allowed.filter(k => !explained.includes(k));
  if (unexplained.length) throw new Error(`engine/template.html has no NODE_TECH explanation for: ${unexplained.join(", ")}`);

  // Drafts never ship: everything injected here is public in the built page.
  const source = await readCases(CASES_DIR, "cases/");
  const published = source.filter(c => c.status !== "draft");
  const drafts = source.length - published.length;
  console.log(`build: found ${source.length} case(s)${drafts ? `, skipping ${drafts} draft(s)` : ""}`);

  await fs.mkdir(DIST_DIR, { recursive: true });
  await copyFonts();

  for (const loc of await locales()) {
    let cases = published;
    if (loc.path) {
      // A translated case ships only while its Portuguese original does.
      const translated = await readCases(path.join(CASES_DIR, loc.code), `cases/${loc.code}/`);
      const live = new Set(published.map(c => c.slug));
      cases = translated.filter(c => live.has(c.slug) && c.status !== "draft");
    }

    const injected = cases
      .map(data => `<script type="application/json" data-case="${data.slug}">${escapeForScript(JSON.stringify(data))}</script>`)
      .join("\n");

    let output = translate(template, loc).replace(MARKER, injected);
    output = output.replace("__CSP_SCRIPT_HASHES__", await scriptHashes(output));
    output = output
      .replaceAll("__SITE_ROOT__", SITE_URL)
      .replaceAll("__SITE_URL__", SITE_URL + loc.path)
      .replaceAll("__ALT_HREF__", loc.alt.href)
      .replaceAll("__ALT_LANG__", loc.alt.lang)
      .replaceAll("__ALT_LABEL__", loc.alt.label)
      .replaceAll("__ALT_TITLE__", loc.alt.title);

    const dir = path.join(DIST_DIR, loc.path);
    await fs.mkdir(dir, { recursive: true });
    const out = path.join(dir, "index.html");
    await fs.writeFile(out, output, "utf-8");

    const open = cases.filter(c => c.status === "open");
    await fs.rm(path.join(dir, "caso"), { recursive: true, force: true });
    for (const c of open) {
      const caseDir = path.join(dir, "caso", c.slug);
      await fs.mkdir(caseDir, { recursive: true });
      await fs.writeFile(path.join(caseDir, "index.html"), casePage(c, loc), "utf-8");
    }
    const bytes = (await fs.stat(out)).size;
    console.log(`build: [${loc.lang}] wrote dist/${loc.path}index.html (${(bytes / 1024).toFixed(1)} KB), ${open.length} case page(s)`);
  }
}

main().catch(err => {
  console.error("build failed:", err.message);
  process.exit(1);
});
