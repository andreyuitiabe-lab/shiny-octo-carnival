# Índice — wiki do CRM / IA conversacional

> Comece por `overview.md` se for sua primeira vez aqui. Este índice é pra achar rápido depois.

## Ponto de partida
- [overview.md](overview.md) — visão geral, comece aqui numa sessão nova
- [status.md](status.md) — o que está feito, em andamento, pendente; perguntas em aberto
- [log.md](log.md) — histórico cronológico append-only
- [quality-gates.md](quality-gates.md) — portão de QA antes de todo push (subagente code-reviewer)

## Arquitetura
- [architecture/crm-overview.md](architecture/crm-overview.md) — banco local, sync, kanban
- [architecture/conversation-flow.md](architecture/conversation-flow.md) — do disparo ao
  fechamento, roteiro de abertura, diagrama publicado

## Referência (consulta rápida — detalhe completo está sempre no playbook)
- [reference/conversation-trajectories.md](reference/conversation-trajectories.md) — rumos A-Q
- [reference/voice-guide.md](reference/voice-guide.md) — como as mensagens devem soar
- [reference/skills-catalog.md](reference/skills-catalog.md) — todas as skills, o que fazem,
  modelo recomendado

## Decisões (ADRs — uma por arquivo, nunca editadas depois de aceitas)
- [decisions/0001-swiftscale-transport-only.md](decisions/0001-swiftscale-transport-only.md)
- [decisions/0002-webhook-vs-polling.md](decisions/0002-webhook-vs-polling.md)
- [decisions/0003-ia-abre-humano-negocia.md](decisions/0003-ia-abre-humano-negocia.md) — a mais
  importante, mudou o escopo de tudo
- [decisions/0004-plataforma-pausada.md](decisions/0004-plataforma-pausada.md) — retomada, ver 0005
- [decisions/0005-plataforma-frontend-first.md](decisions/0005-plataforma-frontend-first.md) —
  plataforma retomada, UI das 3 telas com o design da Claude Design

## Auditorias (snapshots datados)
- [audits/2026-07-20-conversation-audit.md](audits/2026-07-20-conversation-audit.md)

## Fora desta wiki, mas essencial
- `../SELLER-DOSSIER-PLAYBOOK.md` — fonte de verdade operacional (gitignored)
- `../PROJECT-LOG.md` / `../README.md` — documentação da parte mais antiga do projeto (parcel
  scout, satellite scout, deal analyzer) — não sobreposta por esta wiki
- Diagrama do fluxo (artifact publicado):
  https://claude.ai/code/artifact/f1ad770c-5554-49d1-86d1-b5250a75a206
