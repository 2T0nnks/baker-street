#!/usr/bin/env node
/**
 * validate.mjs — runs each case JSON against schema/case.schema.json.
 *
 * Translations in cases/<lang>/ get the same checks, plus one more: they
 * must mirror the Portuguese original (same ids, flow, answers and map),
 * so that only the words change.
 *
 * Exits 0 if every case is valid, non-zero otherwise. Used by the
 * validate.yml workflow on every PR and by `npm run validate` locally.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCHEMA = path.join(ROOT, "schema", "case.schema.json");
const CASES_DIR = path.join(ROOT, "cases");

async function main() {
  const schemaText = await fs.readFile(SCHEMA, "utf-8");
  const schema = JSON.parse(schemaText);

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const files = (await fs.readdir(CASES_DIR)).filter(f => f.endsWith(".json"));
  // Translations: cases/<lang>/<slug>.json, checked against cases/<slug>.json.
  for (const entry of await fs.readdir(CASES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const f of (await fs.readdir(path.join(CASES_DIR, entry.name))).filter(f => f.endsWith(".json"))) {
      files.push(`${entry.name}/${f}`);
    }
  }
  if (files.length === 0) {
    console.error("validate: no cases found in cases/");
    process.exit(1);
  }

  let failed = 0;
  for (const file of files) {
    const raw = await fs.readFile(path.join(CASES_DIR, file), "utf-8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error(`✗ cases/${file}: invalid JSON — ${e.message}`);
      failed++;
      continue;
    }

    const ok = validate(data);
    if (!ok) {
      console.error(`✗ cases/${file}: ${validate.errors.length} schema error(s)`);
      validate.errors.forEach(err => {
        const loc = err.instancePath || "/";
        console.error(`    ${loc}  ${err.message}${err.params ? "  " + JSON.stringify(err.params) : ""}`);
      });
      failed++;
      continue;
    }

    // Extra structural checks the schema can't express well
    const warnings = [];
    const errors = [...checkHtml(data), ...crossCheck(data, warnings)];
    warnings.forEach(w => console.warn(`⚠ cases/${file}: ${w}`));
    if (errors.length) {
      console.error(`✗ cases/${file}:`);
      errors.forEach(e => console.error(`    ${e}`));
      failed++;
      continue;
    }

    // A translation must mirror its original
    if (file.includes("/")) {
      const original = path.join(CASES_DIR, path.basename(file));
      let src = null;
      try { src = JSON.parse(await fs.readFile(original, "utf-8")); } catch {}
      const diffs = src ? mirror(src, data) : [`no original cases/${path.basename(file)} to translate from`];
      if (diffs.length) {
        console.error(`✗ cases/${file}: differs from the Portuguese original:`);
        diffs.forEach(d => console.error(`    ${d}`));
        failed++;
        continue;
      }
    }

    // Filename must match slug
    const expected = path.basename(file).replace(/\.json$/, "");
    if (data.slug !== expected) {
      console.error(`✗ cases/${file}: slug "${data.slug}" does not match filename`);
      failed++;
      continue;
    }

    console.log(`✓ cases/${file}`);
  }

  if (failed > 0) {
    console.error(`\nvalidate: ${failed} case(s) failed.`);
    process.exit(1);
  }
  console.log(`\nvalidate: all ${files.length} case(s) passed.`);
}

// What a translation may not change: everything but the words.
function mirror(src, tr) {
  const shape = c => ({
    slug: c.slug, status: c.status, domain: c.domain, difficulty: c.difficulty, duration: c.duration,
    "context sizes": ["narrative", "actors", "data", "scale"].map(k => (c.context?.[k] || []).length),
    "flow nodes": (c.flow?.nodes || []).map(n => [n.id, n.kind, n.icon, n.x, n.y, !!n.tech]),
    "flow edges": (c.flow?.edges || []).map(e => [e.from, e.to, !!e.boundary, !!e.dashed, !!e.label]),
    candidates: (c.candidates || []).map(x => [x.id, x.truth, x.category]),
    risks: (c.risks || []).map(r => [r.id, r.category, r.severity, JSON.stringify(r.where || null), (r.abuse || []).length, (r.mitigation || []).length]),
    takeaways: (c.takeaways || []).length,
  });
  const a = shape(src), b = shape(tr);
  return Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(k => `${k} differs`);
}

// The engine renders case text with innerHTML, so any markup in a case runs
// on the site's origin. Only bare inline formatting tags are allowed — no
// attributes, no comments, no other elements.
const ALLOWED_TAG = /^<\/?(em|code|strong)>$|^<br\s*\/?>$/i;
const MARKUP = /<[a-zA-Z\/!?][^>]*>?/g;

function checkHtml(data) {
  const errors = [];
  (function walk(value, where) {
    if (typeof value === "string") {
      for (const m of value.matchAll(MARKUP)) {
        if (!ALLOWED_TAG.test(m[0])) {
          errors.push(`${where}: markup not allowed: ${JSON.stringify(m[0].slice(0, 60))} (only <em>, <code>, <strong>, <br> without attributes)`);
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${where}[${i}]`));
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => walk(v, `${where}.${k}`));
    }
  })(data, "$");
  return errors;
}

// Longest edge label the diagram can place between nodes without covering them.
const MAX_EDGE_LABEL = 32;
const MIN_DISTRACTORS = 3;

function crossCheck(data, warnings = []) {
  const errors = [];
  if (data.status !== "open") return errors; // only fully-populated cases

  const nodes = data.flow?.nodes || [];
  const edges = data.flow?.edges || [];
  const candidates = data.candidates || [];
  const risks = data.risks || [];

  // Duplicates the engine can't tell apart
  const dupes = (values, what) => {
    const seen = new Set();
    values.forEach(v => { if (seen.has(v)) errors.push(`duplicate ${what}: ${v}`); seen.add(v); });
  };
  dupes(nodes.map(n => `"${n.id}"`), "flow node id");
  dupes(nodes.map(n => `x=${n.x}, y=${n.y}`), "node position (two nodes would be drawn on top of each other)");
  dupes(edges.map(e => `${e.from} → ${e.to}`), "edge");
  dupes(candidates.map(c => `"${c.id}"`), "candidate id");
  dupes(risks.map(r => `"${r.id}"`), "risk id");

  // Things the diagram can't draw well
  edges.forEach(e => {
    if (e.from === e.to) errors.push(`edge ${e.from} → ${e.to} points to itself — the diagram can't draw loops on one node`);
    const len = (e.label || "").length;
    if (len > MAX_EDGE_LABEL) errors.push(`edge ${e.from} → ${e.to}: label has ${len} characters (max ${MAX_EDGE_LABEL}) — shorten it so it fits between nodes`);
  });
  const connected = new Set(edges.flatMap(e => [e.from, e.to]));
  nodes.filter(n => !connected.has(n.id)).forEach(n => warnings.push(`flow node "${n.id}" has no edges — is that intended?`));

  // The exercise only works if marking everything costs points
  const traps = candidates.filter(c => !c.truth).length;
  if (traps < MIN_DISTRACTORS) {
    errors.push(`only ${traps} distractor(s) (truth: false) — need at least ${MIN_DISTRACTORS}, otherwise marking everything scores full marks`);
  }

  // A real candidate and its risk must agree on the category
  risks.forEach(r => {
    const c = candidates.find(x => x.id === r.id);
    if (c && c.category !== r.category) errors.push(`risk "${r.id}" is "${r.category}" but its candidate is "${c.category}"`);
  });

  // Every real candidate has a matching risk with the same id
  const realIds = (data.candidates || []).filter(c => c.truth).map(c => c.id);
  const riskIds = (data.risks || []).map(r => r.id);
  realIds.forEach(id => {
    if (!riskIds.includes(id)) {
      errors.push(`candidate "${id}" is marked truth:true but has no matching risk entry`);
    }
  });
  riskIds.forEach(id => {
    if (!realIds.includes(id)) {
      errors.push(`risk "${id}" has no matching candidate with truth:true`);
    }
  });

  // Every node says what it is (icon) and explains itself when clicked (description)
  (data.flow?.nodes || []).forEach(n => {
    if (!n.icon) errors.push(`flow node "${n.id}" has no "icon" — see the enum in schema/case.schema.json`);
    if (!n.description || n.description.trim().length < 30) {
      errors.push(`flow node "${n.id}" needs a "description" (30+ characters) — shown when someone clicks the system in the flow`);
    }
  });

  // Every edge references existing node ids
  const nodeIds = new Set((data.flow?.nodes || []).map(n => n.id));
  (data.flow?.edges || []).forEach((e, i) => {
    if (!nodeIds.has(e.from)) errors.push(`flow.edges[${i}].from = "${e.from}" — no such node`);
    if (!nodeIds.has(e.to)) errors.push(`flow.edges[${i}].to = "${e.to}" — no such node`);
  });

  // risks[].where must point at nodes and edges that exist in the flow
  const edgeKeys = new Set((data.flow?.edges || []).map(e => `${e.from}>${e.to}`));
  // …and every published risk needs one, so each case gets the reveal map.
  (data.risks || []).forEach(r => {
    if (!r.where || (!r.where.nodes && !r.where.edges)) {
      errors.push(`risk "${r.id}" has no "where" — list the flow nodes/edges where it lives (feeds the reveal map)`);
    }
    (r.where?.nodes || []).forEach(n => {
      if (!nodeIds.has(n)) errors.push(`risk "${r.id}": where.nodes has "${n}" — no such node`);
    });
    (r.where?.edges || []).forEach(e => {
      if (!edgeKeys.has(`${e.from}>${e.to}`)) errors.push(`risk "${r.id}": where.edges has ${e.from} → ${e.to} — no such edge in flow.edges`);
    });
  });

  // Recommend at least 3 distinct categories in the risks (breadth of the case)
  const cats = new Set((data.risks || []).map(r => r.category));
  if (cats.size < 3) {
    errors.push(`risks span only ${cats.size} category — recommend at least 3 (technical is not enough)`);
  }

  return errors;
}

main().catch(err => {
  console.error("validate failed:", err);
  process.exit(1);
});
