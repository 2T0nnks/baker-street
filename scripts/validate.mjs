#!/usr/bin/env node
/**
 * validate.mjs — runs each case JSON against schema/case.schema.json.
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
    const errors = [...checkHtml(data), ...crossCheck(data)];
    if (errors.length) {
      console.error(`✗ cases/${file}:`);
      errors.forEach(e => console.error(`    ${e}`));
      failed++;
      continue;
    }

    // Filename must match slug
    const expected = file.replace(/\.json$/, "");
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

function crossCheck(data) {
  const errors = [];
  if (data.status !== "open") return errors; // only fully-populated cases

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

  // Every edge references existing node ids
  const nodeIds = new Set((data.flow?.nodes || []).map(n => n.id));
  (data.flow?.edges || []).forEach((e, i) => {
    if (!nodeIds.has(e.from)) errors.push(`flow.edges[${i}].from = "${e.from}" — no such node`);
    if (!nodeIds.has(e.to)) errors.push(`flow.edges[${i}].to = "${e.to}" — no such node`);
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
