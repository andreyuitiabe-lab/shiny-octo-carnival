# Wiki — como isso funciona

Esta wiki documenta o **subsistema de CRM / IA conversacional sobre o SwiftScale** (o que foi
construído a partir de jul/2026). Ela não substitui `../PROJECT-LOG.md` nem `../README.md` — esses
documentam a parte mais antiga do projeto (County Scanner, Parcel Scout, Satellite Scout, Deal
Analyzer). Esta wiki é focada e cross-referencia aqueles quando relevante, sem duplicar.

Estrutura inspirada em [uma ideia do Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
(LLM mantém uma wiki incremental em vez de redescobrir tudo do zero a cada sessão) + no padrão de
[Architecture Decision Records](https://adr.github.io/) (uma decisão por documento, contexto →
decisão → consequências, nunca editado depois — se a decisão muda, um novo ADR supera o antigo e
linka pra ele).

## As três camadas

1. **Fontes brutas (não ficam aqui, nunca são reescritas)**: `../SELLER-DOSSIER-PLAYBOOK.md`
   (procedimento operacional + credenciais — gitignored, nunca citar tokens/IDs aqui), os arquivos
   em `../tools/*.py`, os `SKILL.md` em `~/.claude/skills/*/`, e as conversas reais puxadas do
   SwiftScale. Esta wiki **lê e sintetiza** essas fontes, nunca as duplica byte a byte.
2. **Wiki** (este diretório): páginas markdown sintetizadas — arquitetura, referência, decisões,
   auditorias. Isso é o que compila o conhecimento de forma que não precisa ser re-derivado toda
   sessão.
3. **Esquema** (este arquivo): as convenções abaixo.

## Onde cada coisa vai

- `architecture/` — como o sistema funciona hoje (visão geral, não procedimento passo-a-passo —
  isso fica no playbook).
- `reference/` — material que é consultado, não lido linearmente (catálogo de skills, os rumos
  de conversa, o guia de voz). Ponto de entrada rápido; detalhe completo cross-referenciado.
- `decisions/` — um arquivo por decisão arquitetural, numerado (`0001-`, `0002-`...), formato
  Contexto → Decisão → Consequências. **Nunca editar um ADR já escrito** — se a decisão mudar,
  criar um novo numerado, marcar o antigo como `Status: superseded por 000X`, linkar os dois.
- `audits/` — resultado datado de rodadas do `/audit-conversations` (ou skills futuras de
  auditoria). Cada arquivo é um snapshot — não é editado depois, só referenciado.
- `index.md` — catálogo de toda página desta wiki, uma linha cada, atualizado a cada ingest.
- `log.md` — registro cronológico append-only (o que mudou, quando, por quê) — nunca editar uma
  entrada antiga, só adicionar no fim.

## Regra de segurança

**Nunca colar tokens, location ID, pipeline ID ou qualquer credencial aqui** — esta wiki não é
gitignored (é documentação, deve poder ser lida/compartilhada). Sempre que precisar referenciar
algo assim, aponte pro playbook (`../SELLER-DOSSIER-PLAYBOOK.md §N`) em vez de citar o valor.

## Como manter viva (operações, inspirado no "ingest / query / lint" do Karpathy)

- **Ingest**: depois de uma sessão de trabalho relevante, atualizar/criar as páginas afetadas +
  adicionar uma entrada em `log.md`. A skill `/wiki-update` faz isso.
- **Query**: para responder "como funciona X", ler `index.md` primeiro pra achar a página certa
  em vez de vasculhar tudo.
- **Lint**: periodicamente, checar páginas órfãs (não linkadas em `index.md`), afirmações
  desatualizadas (ex: um ADR cuja decisão já foi superada mas não está marcado), e rumos/skills
  novos que existem no playbook mas não têm página de referência ainda.
