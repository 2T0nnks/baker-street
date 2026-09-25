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

// Reads answers line by line from an async iterator, so it works both when a
// person types and when answers are piped in (rl.question drops piped lines
// that arrive before the question is asked).
async function ask(lines, q, def = "") {
  const suffix = def ? ` [${def}]` : "";
  process.stdout.write(`${q}${suffix}: `);
  const { value, done } = await lines.next();
  const answer = done ? "" : value;
  if (!process.stdin.isTTY) process.stdout.write(answer + "\n"); // echo piped answers
  return answer.trim() || def;
}

async function main() {
  const argSlug = process.argv[2];
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const lines = rl[Symbol.asyncIterator]();

  const slug = argSlug || await ask(lines, "slug (url-safe, kebab-case)", "novo-caso");
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

  const title = await ask(lines, "title (short, 2-60 chars)");
  const subtitle = await ask(lines, "subtitle (one sentence describing the business)");
  const domain = await ask(lines, "domain", "fintech");
  const difficulty = await ask(lines, "difficulty (Iniciante | Intermediário | Avançado)", "Intermediário");
  const author = await ask(lines, "author (your GitHub handle)", "");

  rl.close();

  const skeleton = {
    $schema: "../schema/case.schema.json",
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
    // A small but complete example: it already passes `npm run validate` and
    // renders fully (animated flow, risk map). Replace the content, keep the shape.
    context: {
      narrative: [
        "Primeiro parágrafo — o negócio em uma imagem clara: quem vende o quê, para quem, e como o dinheiro se move.",
        "Segundo — o produto ou fluxo em foco, com os detalhes que um time de produto contaria numa RFC.",
        "Terceiro — o time e as fronteiras humanas: quem aprova, quem opera, o que é manual.",
        "Quarto — terceiros e integrações: o que sai da empresa, para quem, e por quê."
      ],
      actors: [["Cliente", "usa o app"], ["Operação", "aprova manualmente"]],
      data: [["CPF e documentos", "no cadastro"], ["Dados de pagamento", "no checkout"]],
      scale: [["Usuários ativos", "10 mil / mês"], ["Operação", "3 pessoas em turnos"]]
    },
    flow: {
      nodes: [
        { id: "app", label: "App do cliente", kind: "internal", icon: "app", x: 60, y: 40 },
        { id: "api", label: "API", kind: "internal", icon: "api", x: 240, y: 40 },
        { id: "parceiro", label: "Parceiro externo", kind: "external", icon: "partner", x: 440, y: 40 }
      ],
      edges: [
        { from: "app", to: "api", label: "cadastro" },
        { from: "api", to: "parceiro", label: "envia dados", boundary: true }
      ]
    },
    // At least 3 real risks (truth: true, each with a risk below, same id and
    // category) and at least 3 plausible distractors (truth: false).
    candidates: [
      { id: "risco-a", truth: true, category: "técnico", title: "Como o risco A aparece na tela de leitura", sub: "Uma linha de pista" },
      { id: "risco-b", truth: true, category: "privacidade", title: "Como o risco B aparece na tela de leitura", sub: "Uma linha de pista" },
      { id: "risco-c", truth: true, category: "operativo", title: "Como o risco C aparece na tela de leitura", sub: "Uma linha de pista" },
      { id: "armadilha-a", truth: false, category: "técnico", title: "Preocupação plausível que não é o problema aqui", sub: "Por que parece um risco" },
      { id: "armadilha-b", truth: false, category: "lógica", title: "Outra preocupação plausível", sub: "Por que parece um risco" },
      { id: "armadilha-c", truth: false, category: "regulatório", title: "Mais uma armadilha", sub: "Por que parece um risco" }
    ],
    risks: [
      {
        id: "risco-a",
        category: "técnico",
        severity: "alto",
        where: { nodes: ["api"], edges: [{ from: "app", to: "api" }] },
        title: "Título do risco A",
        signal: "Pistas no contexto que apontavam para isso",
        abuse: ["Cenário concreto 1", "Cenário concreto 2"],
        impact: "O que quebra — negócio, regulatório, operativo, financeiro",
        mitigation: ["Ação 1", "Ação 2"]
      },
      {
        id: "risco-b",
        category: "privacidade",
        severity: "médio",
        where: { nodes: ["parceiro"], edges: [{ from: "api", to: "parceiro" }] },
        title: "Título do risco B",
        signal: "Pistas no contexto que apontavam para isso",
        abuse: ["Cenário concreto 1", "Cenário concreto 2"],
        impact: "O que quebra",
        mitigation: ["Ação 1", "Ação 2"]
      },
      {
        id: "risco-c",
        category: "operativo",
        severity: "médio",
        where: { nodes: ["app"] },
        title: "Título do risco C",
        signal: "Pistas no contexto que apontavam para isso",
        abuse: ["Cenário concreto 1", "Cenário concreto 2"],
        impact: "O que quebra",
        mitigation: ["Ação 1", "Ação 2"]
      }
    ],
    takeaways: [
      { title: "Padrão generalizável 1", body: "Como aplicar em outros contextos" },
      { title: "Padrão generalizável 2", body: "Como aplicar em outros contextos" },
      { title: "Padrão generalizável 3", body: "Como aplicar em outros contextos" }
    ]
  };

  await fs.writeFile(target, JSON.stringify(skeleton, null, 2) + "\n", "utf-8");
  console.log(`✓ created cases/${slug}.json`);
  console.log(`  Next steps:`);
  console.log(`    1. Fill it out — see docs/CASE_GUIDELINES.md`);
  console.log(`    2. npm run validate          (checks the schema, the flow and the risk map)`);
  console.log(`       npm run dev                → http://localhost:8000/?caso=${slug}&debug=layout`);
  console.log(`       (shows any label or pin that overlaps something in the diagram)`);
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
