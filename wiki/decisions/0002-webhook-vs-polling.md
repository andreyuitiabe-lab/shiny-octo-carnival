# 0002 — Webhook em vez de polling (só depois que existiu servidor)

**Status:** aceito, mas com nuance de escopo (ver observação final) · **Data:** 2026-07-18/19

## Contexto

Enquanto o sistema era 100% local (scripts Python rodados manualmente numa sessão do Claude
Code, sem nenhum processo sempre-ativo), a única forma de detectar mensagens novas era **polling**
— rodar `tools/crm_sync.py` sob demanda ou numa rotina agendada. Quando Andre decidiu construir
uma plataforma hospedada (Vercel), ele perguntou "é melhor a gente trabalhar com webhooks?" e
confirmou que conseguia gerar a chave de assinatura do lado do GHL.

## Decisão

Com um servidor sempre-ativo (Vercel), **webhook é estritamente melhor que polling**: tempo real,
menos chamadas desnecessárias à API do GHL (onde mora o risco de bloqueio do Cloudflare — ver
`SELLER-DOSSIER-PLAYBOOK.md §0`). O desenho era: Workflow do GHL (trigger "Customer Replied") →
POST assinado → `/api/webhooks/ghl` na Vercel, validando assinatura antes de processar, com
idempotência (dedupe por id de mensagem) e um cron diário só de reconciliação como backup, não
como mecanismo principal.

## Consequências

- Enquanto o sistema roda só via Claude Code (sem servidor), a recomendação **continua sendo
  polling** — não há onde um webhook chegaria. Essa parte da decisão só se aplica no cenário
  "existe uma plataforma hospedada".
- A plataforma hospedada em si foi pausada ([0004](0004-plataforma-pausada.md)) antes de este
  desenho ser implementado — o webhook nunca chegou a ser construído, mas a decisão fica
  registrada pra quando (se) a plataforma for retomada.
