# Schema de um caso — referência

Definição formal: [`schema/case.schema.json`](../schema/case.schema.json)

Este documento é a leitura humana do schema.

## Campos de topo

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `slug` | string | sim | URL-safe, kebab-case. Deve bater com o nome do arquivo (sem `.json`). |
| `status` | enum: `open` \| `soon` \| `draft` | sim | `open` = jogável; `soon` = placeholder no catálogo; `draft` = escondido. |
| `title` | string (2-60) | sim | Nome curto do caso. |
| `subtitle` | string (4-160) | sim | Uma frase descritiva do negócio. |
| `domain` | string | não | Setor (fintech, healthtech, edtech...). |
| `duration` | string | não | Tempo estimado (ex.: `~45 min`). |
| `difficulty` | enum | não | `Iniciante` \| `Intermediário` \| `Avançado`. |
| `tags` | string[] | não | Até 8 tags de 1-24 chars. |
| `license` | string | não | Padrão: `CC-BY-SA-4.0`. |
| `author` | string | não | Handle GitHub. |

**Se `status: "open"`**, os seguintes ficam obrigatórios: `context`, `flow`, `candidates`, `risks`, `takeaways`.

## `context`

```json
{
  "narrative": ["parágrafo 1", "parágrafo 2", "..."],
  "actors": [["Nome", "papel"]],
  "data": [["Dado", "onde/quando"]],
  "scale": [["Métrica", "contexto"]]
}
```

- `narrative`: 2-8 parágrafos. Primeiro é o lede (destacado).
- `actors`, `data`, `scale`: listas de pares `[chave, valor]`.

## `flow`

```json
{
  "nodes": [
    { "id": "app", "label": "App do motorista", "kind": "internal", "x": 60, "y": 40 }
  ],
  "edges": [
    { "from": "app", "to": "api", "label": "cadastro", "boundary": false, "dashed": false }
  ]
}
```

- Node `kind`: `internal` (verde), `boundary` (âmbar), `external` (vermelho).
- Edge `boundary: true` marca cruzamento de fronteira de confiança.
- Edge `dashed: true` marca fluxo assíncrono (callback, event).

## `candidates`

```json
[
  {
    "id": "identificador",
    "truth": true,
    "category": "técnico",
    "title": "Como aparece na tela",
    "sub": "Linha adicional"
  }
]
```

- Mistura riscos reais (`truth: true`) e distratores (`truth: false`).
- Categorias válidas: `técnico` | `lógica` | `operativo` | `processo` | `regulatório` | `privacidade` | `fraude`.
- Mínimo 6 candidatos totais.

## `risks`

Só os reais. `id` de cada risco deve ter um candidato correspondente com `truth: true`.

```json
[
  {
    "id": "identificador",
    "category": "técnico",
    "severity": "crítico",
    "title": "Título curto",
    "signal": "Pistas no contexto (HTML inline ok)",
    "abuse": ["cenário 1", "cenário 2"],
    "impact": "O que quebra",
    "mitigation": ["ação 1", "ação 2"]
  }
]
```

- `severity`: `crítico` | `alto` | `médio` | `baixo`.
- `abuse` e `mitigation` são arrays de string, mínimo 1 elemento cada.
- `signal` aceita HTML inline: `<em>`, `<code>`.

## `takeaways`

```json
[
  { "title": "Padrão", "body": "Como generaliza" }
]
```

## Validação cruzada (não expressa no JSON Schema)

O `validate.mjs` verifica também:
- Nome do arquivo bate com `slug`.
- Todo candidato com `truth: true` tem risco correspondente e vice-versa.
- Todo `edge.from` / `edge.to` referencia nó existente.
- Riscos cobrem no mínimo 3 categorias distintas.
