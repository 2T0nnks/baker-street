# Política de segurança

## Como reportar uma vulnerabilidade

**Não abra issue pública.** Use o reporte privado do GitHub:

→ [Report a vulnerability](https://github.com/2T0nnks/baker-street/security/advisories/new)

Só o mantenedor vê o relato. Inclua o que for possível:

- o que é afetado (site publicado, motor, scripts de build/validação, workflows);
- passos para reproduzir ou uma prova de conceito;
- o impacto que você enxerga.

## O que esperar

Este é um projeto mantido por uma pessoa, no tempo livre. A meta é:

- confirmar o recebimento em até **7 dias**;
- combinar com você um prazo de correção de acordo com a severidade;
- dar crédito no aviso de segurança, se você quiser.

## Escopo

**Dentro:**
- o site em https://2t0nnks.github.io/baker-street/;
- `engine/`, `scripts/`, `schema/` e `.github/workflows/`;
- qualquer forma de um caso (`cases/*.json`) executar código no site ou escapar da validação.

**Fora:**
- o conteúdo dos casos em si: os riscos descritos neles são fictícios e didáticos;
- limitações do GitHub Pages (por exemplo, não permitir cabeçalhos HTTP próprios);
- ataques que exigem acesso prévio à máquina ou à conta de quem visita.

Apenas a versão atual do `main` (a que está publicada) recebe correções.
