# 0005 — Plataforma retomada frontend-first, com o design da Claude Design

**Status:** aceito, em andamento · **Data:** 2026-07-20 · **Continua:** [0004](0004-plataforma-pausada.md)

## Contexto

A plataforma hospedada estava pausada ([0004](0004-plataforma-pausada.md)) até o escopo da IA
ficar claro (decisão [0003](0003-ia-abre-humano-negocia.md): IA só abre conversa, humano negocia).
Com isso resolvido, Andre decidiu retomar. Duas coisas destravaram a retomada:

1. Andre pediu o design inicial via **Claude Design** e recebeu um handoff de alta fidelidade
   (`design_handoff_parcel_crm/` — README detalhado + protótipo HTML + tokens exatos). O design
   já está fundamentado no toolkit real (rumos, buckets de triagem do `triage_rules.py`, funil de
   12 estágios do `crm_db.py`, o problema de "quem está devendo resposta").
2. Andre já tinha contas na Vercel e no Supabase, e o repositório já estava no GitHub
   (`andreyuitiabe-lab/shiny-octo-carnival`).

## Decisão

Construir a plataforma **frontend-first, com dados mock**, antes de conectar Supabase/GHL de
verdade — validar a UI e o design com dados realistas primeiro, backend depois. Ordem:

- **Scaffold Next.js 16** (App Router, TypeScript, sem Tailwind) em `platform/`, deployável na
  Vercel com root directory `platform`.
- **Rota de diagnóstico `/api/cloudflare-check`** — o único risco técnico aberto do plano
  original (o `fetch` serverless da Vercel é bloqueado pelo Cloudflare como o Python urllib?)
  ainda precisa ser validado **na Vercel de verdade** (rodar local não prova nada, é rede
  diferente). Continua bloqueante pra qualquer código que fale com o GHL a partir da plataforma.
- **Fundação compartilhada** (`app/globals.css` com os tokens do handoff, `lib/types.ts`
  espelhando `crm_db.py`, `lib/mock-data.ts` traduzido do protótipo, `components/AppShell`,
  `Badge`, `SellerDossierPanel`, `lib/wait.ts`).
- **As 3 telas** (Kanban com drag-and-drop via dnd-kit, Conversations inbox 3 colunas, Leads
  tabela mestra) — construídas em paralelo por 3 subagentes em worktrees isolados, cada uma
  numa rota própria (sem conflito de arquivo), mescladas uma a uma no `main` com build verde.

Regras de design herdadas do handoff e mantidas no código: zero border-radius, cor de marca
(vermelho) só pra ação primária/nav/não-lidas/"aguardando você" — nunca pra badge de
classificação (essas usam só as cores semânticas); números tabulares; tema escuro padrão, claro
suportado via `data-theme`.

## Consequências

- Ganha: dá pra ver/testar/validar a plataforma inteira com dados realistas antes de gastar
  esforço em backend; o design fica congelado e revisável; cada tela é isolada e substituível.
- Ainda falta (não é backend real ainda): conectar Supabase (schema já desenhado em 0004),
  validar o Cloudflare na Vercel, portar `triage_rules.py` pra TypeScript, o webhook do GHL, e a
  autenticação dos 2 usuários. As telas hoje mutam só estado local do React, nenhuma persiste.
- O motor de negociação via Gemini do plano original **continua fora de escopo** (decisão 0003) —
  o design reflete isso: o dossiê é sempre um "pull" manual, a negociação é digitada pelos
  humanos no composer, não gerada por IA.
- Repositório: `platform/` vive no mesmo repo do toolkit, deployado pela Vercel com root
  directory `platform`.
