# Adler

**Onde a segurança começa.**

Utilitário open source de treinamento em análise de casos de abuso, para times inteiros — produto, engenharia, tesouraria, antifraude e compliance. No papel, antes do primeiro commit.

Cada caso é um fluxo de negócio real. Você analisa o contexto, marca o que considera arriscado e depois compara com os riscos reais, cada um com o caso de abuso, o impacto e a mitigação.

> Homenagem a Irene Adler, a única a superar Sherlock Holmes — porque o leu antes que ele a lesse. É esse o olhar que Adler treina.

## Como funciona

1. **Contexto** — um negócio real com atores, dados e escala.
2. **Fluxo** — diagrama transacional com fronteiras de confiança.
3. **Leitura** — você marca o que suspeita, sem gabarito à mostra.
4. **Revelação** — os riscos reais com casos de abuso, impacto e mitigação.
5. **Placar** — o padrão dos que passaram batido; o que levar pro próximo.

Categorias de risco cobertas: **técnico**, **lógica de negócio**, **operativo**, **processo**, **regulatório**, **privacidade**, **fraude**.

## Como contribuir

Um caso é um único arquivo JSON em `cases/`. Leia `docs/CONTRIBUTING.md` para o passo a passo e `docs/CASE_GUIDELINES.md` pra saber o que faz um caso bom.

## Rodar localmente

```bash
npm install
npm run validate    # roda o JSON Schema em cada caso
npm run build       # gera dist/index.html
npm run new         # scaffold interativo de um caso novo
```

Abra `dist/index.html` no navegador.

## Licenças

- **Código do motor** (`engine/`, `scripts/`): [MIT](./LICENSE)
- **Casos e conteúdo** (`cases/`, `docs/`): [CC BY-SA 4.0](./LICENSE-CASES)

## Comunidade

Contribuidores aceitos entram como **Irregulares** — em referência aos garotos de rua que faziam a reconnaissance de Sherlock em Londres.
