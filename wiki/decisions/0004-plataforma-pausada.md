# 0004 — Plataforma hospedada (Vercel + Supabase + Gemini): planejada, pausada

**Status:** retomado em 2026-07-20 — ver [0005](0005-plataforma-frontend-first.md) para como · **Data:** 2026-07-19/20

## Contexto

Andre pediu pra transformar o CRM local numa plataforma que ele e o sócio acessassem juntos,
rodando sozinha 24/7, usando a API do Gemini (que ele já tinha) pra triagem e negociação.
Planejamos em bastante detalhe, via plan mode formal, aprovado por Andre:

- Stack: Next.js em `platform/` deployado na Vercel, Supabase (Postgres + Auth, 2 contas),
  webhook do GHL (ver `0002-webhook-vs-polling.md`) em vez de polling.
- Schema completo (`contacts`, `stage_history`, `notes`, `drafts`, `messages`).
- Segurança: validação de assinatura de webhook, idempotência, projetos Supabase dev/prod
  separados, bloqueio hard-coded de envio pra "Nao incomodar", guardrail de horário 8h-21h.
- Telas: kanban compartilhado (condensado a 5-7 colunas por prática de mercado), tela de
  conversas (inbox + thread completa + rascunho inline), tabela de gestão de leads.
- Pesquisa de mercado: CRMs de wholesaling (REISift, FreedomSoft, InvestorFuse) + práticas de
  handoff IA→humano, que geraram os gatilhos de escalonamento do design original.
- Ordem de implementação com uma "Fase 0" — auditar as conversas reais ANTES de codar qualquer
  regra ou prompt do Gemini.

## Decisão

A Fase 0 (rodar `/audit-conversations`) foi executada — e o resultado mudou o entendimento do
problema: negociar por SMS envolve nuance demais (rumos I/J/K/L/M/Q/P) pra confiar numa IA
autônoma, mesmo com os gatilhos de escalonamento já desenhados. Andre então decidiu (ver
`0003-ia-abre-humano-negocia.md`) que a IA só abre conversa — negociação e fechamento ficam 100%
humanos. Isso torna a maior parte do motor de negociação planejado pra plataforma (`/api/leads/
[id]/draft` chamando Gemini pra redigir e decidir "prontidão pra proposta") **desnecessário**.

**A plataforma em si não foi descartada** — só pausada, porque:
1. O motivo original (Andre + sócio precisam acessar o mesmo estado) continua válido.
2. Mas o escopo do que ela precisaria fazer é bem menor agora (kanban compartilhado + triagem +
   talvez o roteiro de abertura automatizado — não um motor de negociação).
3. Nenhum código da plataforma chegou a ser escrito (só o plano) — nada pra desfazer.

## Consequências

- Se retomar: revisar o plano original à luz de `0003` antes de tocar em código — o design de
  `/api/leads/[id]/draft` como "negociador Gemini" não se aplica mais; o que sobra é
  essencialmente o kanban compartilhado + a versão hospedada do roteiro de abertura (§1c do
  playbook) + triagem.
- Enquanto pausada, o sistema continua rodando 100% via Claude Code local (ver
  `architecture/crm-overview.md`) — Andre e o sócio não têm acesso compartilhado ainda.
- Ver `../status.md` — "quer retomar a plataforma?" está listado como pergunta em aberto.
