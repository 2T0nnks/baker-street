#!/usr/bin/env node
/**
 * new-case.mjs — scaffolds cases/<slug>.json from an interactive prompt.
 *
 * Usage:  npm run new
 * or:     node scripts/new-case.mjs <slug>
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CASES_DIR = path.resolve(__dirname, "..", "cases");

async function ask(rl, q, def = "") {
  const suffix = def ? ` [${def}]` : "";
  const ans = (await rl.question(`${q}${suffix}: `)).trim();
  return ans || def;
}

async function main() {
  const argSlug = process.argv[2];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const slug = argSlug || await ask(rl, "slug (url-safe, kebab-case)", "novo-caso");
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(slug)) {
    console.error("slug must be lowercase, alphanumeric or dashes, starting with letter/digit");
    process.exit(1);
  }
  const target = path.join(CASES_DIR, `${slug}.json`);
  try {
    await fs.access(target);
    console.error(`cases/${slug}.json already exists`);
    process.exit(1);
  } catch { /* ok — file does not exist */ }

  const title = await ask(rl, "title (short, 2-60 chars)");
  const subtitle = await ask(rl, "subtitle (one sentence describing the business)");
  const domain = await ask(rl, "domain", "fintech");
  const difficulty = await ask(rl, "difficulty (Iniciante | Intermediário | Avançado)", "Intermediário");
  const author = await ask(rl, "author (your GitHub handle)", "");

  rl.close();

  const skeleton = {
    slug,
    status: "draft",
    domain,
    title,
    subtitle,
    duration: "~45 min",
    difficulty,
    tags: [],
    license: "CC-BY-SA-4.0",
    author,
    context: {
      narrative: [
        "Primeiro parágrafo — o negócio em uma imagem clara.",
        "Segundo — o produto ou fluxo em foco.",
        "Terceiro — o time e as fronteiras humanas.",
        "Quarto — terceiros e integrações."
      ],
      actors: [["Nome", "papel curto"]],
      data: [["Dado", "onde/quando"]],
      scale: [["Métrica", "contexto"]]
    },
    flow: {
      nodes: [
        { id: "app", label: "App", kind: "internal", icon: "app", x: 60, y: 40 }
      ],
      edges: []
    },
    candidates: [
      {
        id: "exemplo",
        truth: true,
        category: "técnico",
        title: "Como aparece na tela de leitura",
        sub: "Uma linha adicional de pista"
      }
    ],
    risks: [
      {
        id: "exemplo",
        category: "técnico",
        severity: "alto",
        where: { nodes: ["app"] },
        title: "Título do risco real",
        signal: "Pistas no contexto que apontavam para isso",
        abuse: ["Cenário concreto 1", "Cenário concreto 2"],
        impact: "O que quebra — negócio, regulatório, operativo, financeiro",
        mitigation: ["Ação 1", "Ação 2"]
      }
    ],
    takeaways: [
      { title: "Padrão generalizável", body: "Como aplicar em outros contextos" }
    ]
  };

  await fs.writeFile(target, JSON.stringify(skeleton, null, 2) + "\n", "utf-8");
  console.log(`✓ created cases/${slug}.json`);
  console.log(`  Next steps:`);
  console.log(`    1. Fill it out — see docs/CASE_GUIDELINES.md`);
  console.log(`    2. npm run validate`);
  console.log(`    3. Change "status": "draft" → "open" once complete`);
  console.log(`    4. git switch -c caso/${slug}`);
  console.log(`       git add cases/${slug}.json`);
  console.log(`       git commit -m "add: case ${slug}"`);
  console.log(`       git push -u origin caso/${slug}   # then open a pull request`);
}

main().catch(err => {
  console.error("new-case failed:", err.message);
  process.exit(1);
});
