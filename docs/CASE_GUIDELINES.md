# Anatomia de um caso bom

Adler treina o *olhar* — não é checklist OWASP, não é revisão de código, não é threat model retroativo. É a habilidade de ler um fluxo e antecipar quem vai abusar dele antes de haver commit.

Um caso bom respeita essa promessa. Aqui está o que a gente considera na revisão editorial.

## O que é um caso, filosoficamente

Um cenário de negócio real (ou realisticamente inspirado) onde:

- **O contexto é rico.** A pessoa que vai treinar precisa se sentir "chegando ao squad amanhã", não lendo uma corporação genérica com "um endpoint".
- **Vários vetores estão presentes.** Um caso que só ensina IDOR é um exercício. Um caso que mistura técnico + lógica + operativo + regulatório é *treino de olhar*.
- **Os distratores são inteligentes.** Se todos os itens marcáveis são obviamente reais, não há treino. Um bom caso tem 3-5 armadilhas plausíveis — preocupações reais, mas não *o que quebra aqui*.
- **As mitigações resolvem.** Não vale "monitorar melhor", "treinar o time" ou "revisar processos". Cada mitigação tem que ser algo que um dev/BISO/ops implementaria no sprint seguinte.

## Categorias de risco

Todo caso deve cobrir múltiplas categorias. Se você só tem riscos `técnico`, refaça — não é um caso, é uma revisão de código.

| Categoria | O que é |
|---|---|
| `técnico` | Vulnerabilidade clássica de código — IDOR, injection, HMAC ausente, race condition. |
| `lógica` | Abuso da lógica de negócio — fórmula manipulável, aceite duplo, cancelamento sem reversão. |
| `operativo` | Quebras no fluxo humano/procedimento — conciliação em planilha, aprovação por chat, runbook incompleto. |
| `processo` | SoD ausente, maker-checker faltando, papéis acumulados, permissões amplas. |
| `regulatório` | LGPD, PCI, KYC, BACEN, retenção. |
| `privacidade` | Minimização, finalidade, compartilhamento com terceiros. |
| `fraude` | Antifraude, velocity, fingerprint, cross-account detection. |

## Estrutura de um caso completo

### Contexto (`context.narrative`)

**Quatro parágrafos, no máximo.** O primeiro é o lede — a empresa em uma imagem. Os próximos aprofundam: o produto, o time, as integrações.

Regras de ouro:
- Use vocabulário que quem trabalha no domínio usaria: "backoffice", "tesouraria", "reconciliação D+1", "webhook /pix/callback", "cerimônia de chaves". Não use "sistema principal", "usuários", "banco de dados" abstratos.
- Nomeie o produto e a empresa (fictícios são ok). Isso ajuda a imersão.
- Números específicos: "18k motoristas ativos", "40% ao mês", "3 pessoas na tesouraria". Números específicos são pistas — quantidade importa pra dimensionar risco.
- Mencione **fronteiras humanas**: quem trabalha em outro prédio, quem faz turnos, quem só chega pela manhã. Isso ilumina vetores operativos.

### Atores, dados, escala (`context.actors`, `.data`, `.scale`)

Listas curtas (5-7 itens cada), pares chave-valor.

- **Atores**: quem interage com o sistema. Inclui operadores humanos e sistemas terceiros.
- **Dados**: os principais elementos de dado sensível em jogo, e para que servem.
- **Escala e ritmo**: números que ajudam a dimensionar. Volume, crescimento, tamanho de time.

### Fluxo (`flow`)

Nós (`nodes`) e arestas (`edges`). Cada nó marca `kind`:
- `internal` — sistema que você controla
- `boundary` — sua fronteira externa (bucket, webhook, endpoint público)
- `external` — terceiro (KYC, adquirente, provider)

Coordenadas `x`, `y` são pra layout. Convenção atual:
- Colunas: `x` = 60, 240, 440, 640
- Linhas: `y` = 40, 160, 260

Não é obrigatório seguir — o motor faz reflow — mas ajuda a consistência entre casos.

**Cada aresta com `boundary: true`** representa cruzamento de fronteira de confiança (marcado em cor de alerta na revelação). É onde os problemas moram.

### Candidatos (`candidates`)

Tudo que aparece na tela de leitura como opção marcável. Mistura de **reais** (`truth: true`) e **distratores** (`truth: false`).

Alvo:
- **5-8 candidatos reais** cobrindo pelo menos 3 categorias
- **3-5 distratores plausíveis**

Cada candidato tem:
- `title`: como aparece no cabeçalho do checkbox (curto, direto)
- `sub`: uma linha adicional de pista — sinaliza por que é/não é o problema

**Distratores plausíveis são a alma do treino.** Alguns padrões que funcionam:
- Uma preocupação real mas não sinalizada no contexto ("Senhas em MD5" — o contexto não diz)
- Um trade-off intencional ("Sessão longa" — é UX, não bug)
- Uma vulnerabilidade real mas fora da camada em foco ("SQL injection" — outra revisão)
- Uma feature que parece brecha ("Alteração retroativa de limite" — é intencional com controle)

Distratores fracos ("Senhas fracas"; "Não usa HTTPS") tornam o caso infantil. Distratores fortes obrigam a pessoa a parar e pensar.

### Riscos (`risks`)

Só os reais. Cada risco tem os mesmos `id`, `category` do candidato correspondente, e:

- **`severity`**: `crítico` | `alto` | `médio` | `baixo`
- **`signal`**: as pistas no contexto que apontavam pra ele. HTML inline (`<code>`, `<em>`) é ok. Ancore a explicação em algo que estava escrito no contexto — "o contexto menciona X", "a operação diária pressupõe Y".
- **`abuse`**: 2-4 cenários concretos de abuso. Não são listas de "possíveis riscos" — são *como um adversário faria*. Escreve como se fosse ficção mínima: "Motorista aceita frete, executa, antecipa, depois cancela...". Concreto vence abstrato.
- **`impact`**: o que quebra. Financeiro, regulatório, operativo, reputacional. Preferência por consequências mensuráveis: "multa até 2%", "achado grave em BACEN", "rombo direto na DRE".
- **`mitigation`**: 2-4 ações concretas. Ordem: a primeira é a mitigação de código/config; as próximas são camadas defensivas (auditoria, alerta, processo).

### Takeaways (`takeaways`)

3-7 padrões generalizáveis. Não são resumo do caso — são o que a pessoa carrega pro *próximo* caso.

Exemplos bons:
- "Autorização é uma decisão de linha de código, não de política"
- "Callbacks externos são inputs adversariais"

Exemplos ruins (evitar):
- "Sempre use HMAC no webhook" (isso é uma mitigação específica, não um padrão)
- "Segurança é importante" (banal)

## Idioma

Português brasileiro é o idioma principal. Traduções pra outros idiomas são feitas como forks/branches específicos — não misturamos idiomas dentro de um mesmo case JSON.

## Anonimização

Se seu caso é inspirado em uma empresa real:
- Troque nomes, valores concretos, escalas — mantenha o *shape* do problema, não a identidade
- Não use nomes de produtos reais, mesmo genéricos
- Não use CNPJ, endereços, nomes de pessoas reais
- Se em dúvida, cria uma persona fictícia com base no arquétipo

Adler existe pra ensinar padrões, não pra expor casos específicos.

## Quando um caso é "bom o suficiente"

- Você mesmo, depois de escrever, resolveu ele — e ainda descobriu algo
- Um colega leu o contexto sem gabarito e marcou alguns distratores como reais
- As mitigações passariam por revisão da liderança técnica sem ajustes

Se está próximo disso, PR.
