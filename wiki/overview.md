# Comece aqui — visão geral do CRM / IA conversacional

> Se você é uma sessão nova (Claude ou humano) pegando este projeto pela primeira vez: leia esta
> página inteira antes de mexer em qualquer coisa. Ela te dá o estado atual em ~5 minutos. Depois
> disso, `status.md` diz o que falta, e `index.md` acha a página certa pra qualquer detalhe.

## O que é isso

Andre faz land wholesaling na Tennessee: dispara SMS em massa via **SwiftScale** (um white-label
do GoHighLevel) pra donos de terreno, e quer transformar as respostas em negócios fechados. Antes
disso, ele respondia tudo manualmente e filtrava quem valia a pena na mão. O objetivo deste
subsistema é automatizar a parte **mecânica e repetitiva** (abrir conversa, triar quem é ruído)
mantendo a parte de **negociar e fechar 100% humana** (Andre e o sócio dele) — essa divisão foi
uma decisão explícita, não um acidente de escopo (ver `decisions/0003-ia-abre-humano-negocia.md`).

## O que existe hoje (peças construídas)

| Peça | O que faz | Onde |
|---|---|---|
| `tools/crm_db.py` + `crm_write.py` | Nosso banco local (JSON), fonte de verdade de estágio/triagem/notas/rascunhos — não o GHL | `tools/` |
| `tools/crm_sync.py` | Lê mensagens novas do GHL (via curl, nunca urllib/requests — Cloudflare bloqueia), roda o filtro determinístico | `tools/` |
| `tools/triage_rules.py` | Filtro de regex zero-IA que resolve a maioria das respostas de graça (STOP, recusa, número errado, sinal de preço) | `tools/` |
| `app/crm-kanban.html` | Kanban visual do banco local, drag-and-drop, sem servidor | `app/` |
| Skill `/audit-conversations` | Lê o histórico completo de conversas reais, testa contra os rumos A-Q, propõe atualizações ao playbook | `~/.claude/skills/audit-conversations/` |
| Skill `/triage-inbox` | Roda a triagem em lote (a fila que sobrou do filtro determinístico) | `~/.claude/skills/triage-inbox/` |
| Skill `/lead-agent` | **Redator sob demanda** — Andre dá a intenção, ela escreve a mensagem (nunca decide sozinha, nunca envia) | `~/.claude/skills/lead-agent/` |
| Skill `/send-approved` | Único ponto que efetivamente manda SMS — sempre com aprovação humana | `~/.claude/skills/send-approved/` |
| Skill `/seller-dossier` | Pesquisa completa do lote (parcela, satélite, valuation, 3 números de oferta) — sempre manual, acionada por Andre | `~/.claude/skills/seller-dossier/` (fora deste repo) |
| `SELLER-DOSSIER-PLAYBOOK.md` | **A fonte de verdade operacional** — credenciais, endpoints, rumos de conversa, guia de voz, matemática de oferta. Gitignored. | raiz do repo |

## O que está pausado

A ideia de virar uma **plataforma hospedada** (Vercel + Supabase + Gemini, pro Andre e o sócio
acessarem juntos) foi planejada em detalhe mas **pausada** antes de ser construída — ver
`decisions/0004-plataforma-pausada.md`. O motivo: a auditoria de conversas mudou o escopo do que
a IA deveria fazer (decisão 0003), o que tornaria boa parte do design da plataforma (o motor de
negociação via Gemini) obsoleto. Se for retomada, revisar 0003 e 0004 antes de continuar.

## Os 3 documentos que importam mais

1. **`../SELLER-DOSSIER-PLAYBOOK.md`** — o procedimento de verdade (§1b rumos, §1c roteiro de
   abertura, §6b voz). Gitignored, tem credenciais — nunca citar os valores aqui na wiki.
2. **`status.md`** (nesta wiki) — o que falta fazer, atualizado a cada sessão.
3. **`log.md`** (nesta wiki) — o histórico cronológico de decisões, pra entender COMO chegamos
   no estado atual, não só qual é.

## Como continuar numa sessão nova

1. Leia esta página + `status.md`.
2. Se for mexer em conversa/triagem/negociação, leia `SELLER-DOSSIER-PLAYBOOK.md` §1b/§1c/§6b
   primeiro — são a fonte de verdade, esta wiki só sintetiza.
3. Se for retomar a plataforma hospedada, leia `decisions/0003` e `decisions/0004` antes de
   qualquer código novo.
4. Ao terminar uma sessão de trabalho relevante, rode a skill `/wiki-update` (ou atualize
   manualmente `status.md` + `log.md` + a página específica que mudou).
