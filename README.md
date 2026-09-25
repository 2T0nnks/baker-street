# Adler

**Onde a segurança começa.**

[![Deploy](https://github.com/2T0nnks/baker-street/actions/workflows/deploy.yml/badge.svg)](https://github.com/2T0nnks/baker-street/actions/workflows/deploy.yml)
[![Validate](https://github.com/2T0nnks/baker-street/actions/workflows/validate.yml/badge.svg)](https://github.com/2T0nnks/baker-street/actions/workflows/validate.yml)
[![Código: MIT](https://img.shields.io/badge/c%C3%B3digo-MIT-4C5C34)](./LICENSE)
[![Casos: CC BY-SA 4.0](https://img.shields.io/badge/casos-CC%20BY--SA%204.0-B04A22)](./LICENSE-CASES)

Adler é um utilitário open source de treinamento para ensinar **casos de abuso** de um fluxo, sob diferentes perspectivas, aos times de ideação e desenvolvimento de produtos, processos e fluxos — produto, engenharia, segurança, tesouraria, antifraude, compliance.

Cada caso é um fluxo de negócio realista. Você lê o contexto, estuda o fluxo, marca o que considera arriscado e só então vê os riscos reais: o caso de abuso concreto, o impacto e a mitigação. No papel, antes do primeiro commit.

### ▶ [Jogar agora: 2t0nnks.github.io/baker-street](https://2t0nnks.github.io/baker-street/)

Roda no navegador, sem cadastro, sem instalar nada e sem nenhuma requisição a terceiros.

---

## Casos

| Caso | Domínio | Nível | O cenário |
|---|---|---|---|
| [Frete Adiantado](https://2t0nnks.github.io/baker-street/?caso=frete-adiantado) | fintech | Intermediário | Antecipação de recebíveis para caminhoneiros num marketplace de fretes |
| [Indique e Ganhe](https://2t0nnks.github.io/baker-street/?caso=indique-e-ganhe) | fintech | Intermediário | Campanha de indicação com bônus em dinheiro numa carteira digital com PIX |
| [Link de Pagamento](https://2t0nnks.github.io/baker-street/?caso=link-de-pagamento) | fintech | Intermediário | Subcredenciadora que vende por link para pequenos lojistas e repassa em D+2 |
| [Saque Antecipado](https://2t0nnks.github.io/baker-street/?caso=saque-antecipado) | fintech | Avançado | Antecipação do saque-aniversário do FGTS vendida por correspondentes bancários |
| [Cofre de Chaves](https://2t0nnks.github.io/baker-street/?caso=cofre-de-chaves) | fintech | Avançado | HSM que assina o PIX de um banco digital e um plano pós-quântico feito às pressas |
| [Consulta Expressa](https://2t0nnks.github.io/baker-street/?caso=consulta-expressa) | saúde | Intermediário | Telemedicina por assinatura com receita, atestado e farmácias parceiras |

**Em breve:** Tutor com IA na sala de aula (edtech) · Fila de Especialidades (saúde pública).

Cada caso publicado traz 8 riscos reais espalhados por pelo menos três categorias — **técnico**, **lógica de negócio**, **operativo**, **processo**, **regulatório**, **privacidade**, **fraude** — e armadilhas plausíveis: preocupações reais que não são o problema daquele fluxo.

## Como funciona um caso

| Estágio | O que acontece |
|---|---|
| **1. Contexto** | A empresa, o produto, o time, os terceiros e os números. Os detalhes que sustentam os riscos estão aqui, como estariam numa RFC de verdade. |
| **2. Fluxo** | O diagrama se monta na ordem em que os dados passam, com pacotes circulando pelas conexões. Fronteiras de confiança em destaque. Clique num sistema para ver o que ele faz no caso, **o que ele é tecnicamente** (HSM, webhook, adquirente, KYC…) e com quem troca dados. |
| **3. Leitura** | Você marca tudo o que parecer um risco, sem gabarito à mostra. Parte do treino é reconhecer as armadilhas. |
| **4. Revelação** | Os riscos reais, cada um com as pistas no contexto, os casos de abuso, o impacto e a mitigação. Um **mapa de riscos** mostra no próprio fluxo onde cada risco mora — verde para o que você pegou, vermelho para o que passou batido. |
| **5. Placar** | Acerto soma, armadilha marcada desconta: marcar tudo não compensa. Fecha com os padrões que valem para o próximo caso. |

Depois de revelar, a leitura fica travada — a resposta não muda depois de ver o gabarito. Para refazer, use **Refazer leitura**.

## Para usar em treinamentos

- **Uma sessão por caso**, de 60 a 90 minutos.
- **Leitura individual e em silêncio**: cada pessoa percorre o caso no próprio navegador e marca a sua leitura.
- **Revelação em grupo**: abram a revelação juntos e comparem quem marcou o quê, categoria por categoria.
- **As divergências entre áreas são o melhor material.** Produto, engenharia, tesouraria, antifraude e compliance enxergam casos de abuso diferentes no mesmo fluxo — é exatamente esse ponto cego que o Adler expõe.
- Funciona bem para **onboarding cruzado** e como aquecimento antes de revisar a RFC de um fluxo real.

## Contribuir com um caso

Um caso é um único arquivo JSON em `cases/`. O motor não tem código específico por caso: fluxo animado, painel dos sistemas, mapa de riscos e placar saem todos dos dados.

```bash
npm install
npm run new          # cria cases/<slug>.json com um exemplo completo e válido
npm run validate     # schema + tudo o que o motor precisa para desenhar o caso
npm run dev          # http://localhost:8000/?caso=<slug>&debug=layout
```

Com `debug=layout`, o site mostra embaixo do fluxo e do mapa de riscos se algum rótulo, pino ou seta ficou em cima de outra coisa. Quando estiver verde, é só abrir o pull request — o CI valida automaticamente e a revisão editorial olha realismo, armadilhas e mitigações.

- [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) — passo a passo
- [docs/CASE_GUIDELINES.md](./docs/CASE_GUIDELINES.md) — o que faz um caso bom
- [docs/SCHEMA.md](./docs/SCHEMA.md) — todos os campos

Quem tem um caso aprovado entra como **Irregular** — em referência aos garotos de rua que faziam o reconhecimento de campo para Sherlock Holmes em Londres.

## Estrutura do repositório

```
cases/       um JSON por caso (CC BY-SA 4.0)
engine/      o motor: um único template HTML com CSS e JS (MIT)
schema/      JSON Schema dos casos
scripts/     build, validação, gerador de casos e servidor local
docs/        guias de contribuição, de escrita de casos e do schema
.github/     CI (validação em todo PR), deploy no GitHub Pages, Dependabot
```

O build injeta os casos no template e gera `dist/index.html` mais as fontes em `dist/fonts/` — é isso que o GitHub Pages publica a cada merge no `main`.

## Privacidade e segurança do site

- **Nenhuma requisição a terceiros**: fontes servidas do próprio domínio, sem analytics.
- **Content-Security-Policy** que só libera o script do motor.
- **Validação do conteúdo**: casos só aceitam `<em>`, `<code>`, `<strong>` e `<br>`, sem atributos; qualquer outra marcação reprova no CI.
- O progresso fica apenas no seu navegador (`localStorage`).

Achou uma vulnerabilidade? Não abra issue pública: veja o [SECURITY.md](./SECURITY.md).

## Licenças

- **Código** (`engine/`, `scripts/`): [MIT](./LICENSE)
- **Casos e documentação** (`cases/`, `docs/`): [CC BY-SA 4.0](./LICENSE-CASES)

## O nome

Homenagem a **Irene Adler**, a única a superar Sherlock Holmes — porque o leu antes que ele a lesse. É esse o olhar que o Adler treina: identificar os casos de abuso de um produto antes de ele existir.

O repositório se chama `baker-street`.
