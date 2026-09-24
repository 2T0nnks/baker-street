# Contribuindo com o Adler

Adler é um projeto de conteúdo curado. Cada caso é um **arquivo JSON único** em `cases/`. O motor da plataforma não sabe nada específico sobre nenhum caso — só lê o schema.

Se você tem um cenário de negócio interessante em que produto, engenharia, tesouraria ou compliance passariam batido em um risco real, você já sabe escrever um caso.

## Setup local (5 minutos)

Você precisa de Node 20+ instalado.

```bash
git clone https://github.com/2T0nnks/baker-street.git
cd baker-street
npm install
```

Rodou? Ótimo. Vamos escrever.

## Adicionar um caso novo

1. **Scaffold do arquivo:**
   ```bash
   npm run new
   ```
   Responde as perguntas (slug, título, subtítulo, domínio). O script cria `cases/<slug>.json` com o esqueleto correto e status `"draft"`. Rascunhos ficam fora do build e não são publicados até você mudar o status.

2. **Edita o JSON.** Preenche narrativa, atores, dados, escala, fluxo, candidatos e riscos. Leia `docs/CASE_GUIDELINES.md` pra saber o que faz um caso bom.

3. **Valida:**
   ```bash
   npm run validate
   ```
   Se der erro, ele aponta o campo. Se passar, `✓ cases/<slug>.json`.

4. **Testa localmente:**
   ```bash
   npm run build
   npm run dev
   ```
   Abre `http://localhost:8000`. Roda seu caso do início ao fim. Volte, ajuste, iterage.

5. **Promove pra `"open"`:**
   Muda o campo `"status": "draft"` pra `"status": "open"` quando estiver pronto.

6. **PR:**
   ```bash
   git checkout -b caso/<slug>
   git add cases/<slug>.json
   git commit -m "add: caso <slug>"
   git push origin caso/<slug>
   ```
   Abre o PR pelo GitHub. O template já vem com um checklist. Preenche.

## O que acontece depois

- **CI valida automaticamente** em cada push do PR (`.github/workflows/validate.yml`). Se falhar, o PR fica marcado com ✗ e você vê o log do erro.
- **Revisão editorial** — o mantenedor (@2T0nnks por enquanto) revisa o *conteúdo*: realismo, qualidade dos abuse cases, plausibilidade dos distratores, se as mitigações realmente resolvem.
- **Merge** — quando aprovado, o merge no main dispara o deploy automático. Em ~1 minuto seu caso está no site.
- **Autor entra como Irregular** — você fica creditado no README como contribuidor.

## Ajustes em casos existentes

Mesma dinâmica: fork, branch (`fix/<slug>-<coisa>`), edit, validate, PR. Casos podem ser melhorados a qualquer momento — descrições mais claras, mitigações mais precisas, distratores mais afiados.

## Ajustes no motor

Se você quer melhorar o engine (UI, renderização, filtros, animações), abre issue primeiro descrevendo a mudança. Motor é código MIT em `engine/` e `scripts/`. Uma modificação no motor afeta todos os cases, então revisamos com carinho.

## Padrões de commit

Prefixos que a gente usa:
- `add:` — novo caso ou nova feature
- `fix:` — correção de bug/typo
- `edit:` — melhoria em conteúdo existente
- `motor:` — mudança no engine
- `docs:` — só documentação

## Licenças

- **Código** (`engine/`, `scripts/`): MIT
- **Casos e docs** (`cases/`, `docs/`): CC BY-SA 4.0

Ao contribuir, você concorda em publicar seu conteúdo sob a licença correspondente.
