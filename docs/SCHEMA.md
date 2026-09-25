# Schema de um caso — referência

Definição formal: [`schema/case.schema.json`](../schema/case.schema.json)

Este documento é a leitura humana do schema.

## Campos de topo

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `slug` | string | sim | URL-safe, kebab-case. Deve bater com o nome do arquivo (sem `.json`). |
| `status` | enum: `open` \| `soon` \| `draft` | sim | `open` = jogável; `soon` = placeholder no catálogo; `draft` = fora do build, nunca publicado. |
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
    { "id": "app", "label": "App do motorista", "kind": "internal", "icon": "app", "x": 60, "y": 40 }
  ],
  "edges": [
    { "from": "app", "to": "api", "label": "cadastro", "boundary": false, "dashed": false }
  ]
}
```

- Node `kind`: `internal` (verde), `boundary` (âmbar), `external` (vermelho).
- Node `description` (obrigatório em casos `open`, até 400 caracteres): aparece quando a pessoa clica no sistema, no fluxo e no mapa de riscos. Descreva o que o sistema é, quem opera e que dados passam — **sem apontar os riscos**, senão vira gabarito antes da leitura.
- Node `tech` (opcional, até 600 caracteres): explicação técnica do conceito, na seção "O que é, tecnicamente" do painel. Sem ela, o motor mostra uma explicação genérica do tipo do nó (o que é uma API, um banco de dados, um HSM…). Use quando o termo é específico (KYC, sub-adquirente, SPI, averbação…). Também sem apontar o risco.
- Edge `description` (opcional, até 300 caracteres): aparece embaixo da conexão, no painel do sistema.
- Node `icon` (obrigatório em casos `open`): o que o sistema é, desenhado como ícone no nó e listado na legenda do fluxo. Valores: `user`, `app`, `web`, `api`, `service`, `database`, `storage`, `queue`, `webhook`, `payment`, `bank`, `partner`, `team`, `ai`, `document`, `spreadsheet`, `email`, `audit`, `key`.
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
    "where": { "nodes": ["api"], "edges": [{ "from": "app", "to": "api" }] },
    "title": "Título curto",
    "signal": "Pistas no contexto (HTML inline ok)",
    "abuse": ["cenário 1", "cenário 2"],
    "impact": "O que quebra",
    "mitigation": ["ação 1", "ação 2"]
  }
]
```

- `severity`: `crítico` | `alto` | `médio` | `baixo`.
- `where` (obrigatório em casos `open`): onde o risco mora no fluxo, com ids de `flow.nodes` e pares `from`/`to` de `flow.edges`. Alimenta o **mapa de riscos** da revelação: o número do risco fica no primeiro nó (ou, sem nós, na primeira aresta) e tudo o que estiver listado acende quando a pessoa passa o mouse. O `npm run validate` confere se os ids existem.
- `abuse` e `mitigation` são arrays de string, mínimo 1 elemento cada.
- Qualquer texto do caso aceita só estas tags, sem atributos: `<em>`, `<code>`, `<strong>`, `<br>`. O `npm run validate` rejeita qualquer outra marcação (`<img>`, `<a>`, `<script>`, atributos como `onclick`, comentários HTML), porque o motor renderiza o texto como HTML.

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
