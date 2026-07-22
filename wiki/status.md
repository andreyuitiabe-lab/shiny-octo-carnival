# Status — feito vs. pendente

> Atualizado a cada sessão relevante (pela skill `/wiki-update` ou manualmente). Não é um
> histórico — para isso veja `log.md`. Isso aqui é só "onde estamos agora".

## ✅ Feito

- [x] **Plataforma deployada na Vercel + risco do Cloudflare DESCARTADO** (21 jul 2026) — deploy
      real da Vercel (Root Directory `platform`, env vars do GHL setadas, deployment protection
      desligada), e a rota `/api/cloudflare-check` retornou `ok: true`: o `fetch` serverless da
      Vercel fala com a API do GHL normalmente (ao contrário do Python urllib local). Webhook
      viável, sem gambiarra de polling. Ver `decisions/0002-webhook-vs-polling.md` (resolução).
- [x] Banco local próprio (`crm_db.py`/`crm_write.py`/`crm_sync.py`) — testado ponta a ponta
      contra a conta real do SwiftScale (71-80 contatos reais sincronizados).
- [x] Filtro determinístico (`triage_rules.py`) — testado, resolve a maioria das respostas sem
      gastar IA.
- [x] Kanban local (`app/crm-kanban.html`) — testado visualmente com screenshot contra dados reais.
- [x] `.gitignore` protegendo `crm_db.json` (PII real: nomes, telefones, conteúdo de SMS).
- [x] Skill `/audit-conversations` criada e **rodada de verdade** contra as 80 conversas reais
      (677 mensagens) — ver `audits/2026-07-20-conversation-audit.md`.
- [x] Rumos I/J/K/L/M/Q/P adicionados ao playbook §1b a partir da auditoria.
- [x] Roteiro de abertura condicional (playbook §1c) — desenhado, revisado com Andre, e ajustado
      (ordem de "outros lotes" corrigida pra ser condicional, não pergunta às cegas).
- [x] Guia de voz (playbook §6b) extraído de 420 mensagens reais.
- [x] `/lead-agent` reescrita de "negociador autônomo" pra "redator sob demanda" — testada uma
      vez contra o lead real Grigorios Miaris (achou e corrigiu um bug: rascunho saiu em
      português por engano).
- [x] Diagrama do fluxo publicado como artifact (atualizado 2x conforme o design evoluiu):
      https://claude.ai/code/artifact/f1ad770c-5554-49d1-86d1-b5250a75a206
- [x] Decisão de escopo fechada: IA só abre conversa, humano negocia e fecha (ver
      `decisions/0003-ia-abre-humano-negocia.md`).
- [x] Esta wiki.
- [x] Plano de implementação em 2 fases aprovado (Fase 1 local, Fase 2 plataforma revisada).
- [x] **Bug do rumo J corrigido em `tools/triage_rules.py`** — novo bucket `possible_rumo_j`
      (preço extremo/irônico não é mais tratado como sinal quente automático; nunca auto-
      descarta, só sinaliza pra revisão humana). Self-test passando com os casos reais (Ray
      Mccord, Carl Katims, limiar de $1M).
- [x] **Skill `/opening-script` criada** — implementa o roteiro §1c como automação real (não só
      documentação), com o limite explícito de ser a única automação que envia sem aprovação
      humana por mensagem, e para no primeiro sinal de negociação. Linkada de dentro do
      `/triage-inbox` (step 6).
- [x] **Instrução de delegação Haiku corrigida** em `/triage-inbox` — faltava `run_in_background:
      false` e a exigência de prompt autocontido pro sub-agente (achado por auditoria de um
      subagente dedicado a isso).
- [x] **`/send-approved` validado com envio real, ponta a ponta** — `POST
      /conversations/messages` pro número do próprio Andre (+19712669323, contato
      `wtmPxWT2E1esYNq4GwdV`) retornou sucesso (`conversationId`/`messageId`) E Andre confirmou
      recebimento real no celular. O token original só tinha escopos de leitura (View
      Contacts/Conversations, Edit Contacts/Opportunities) — faltava o escopo de escrita de
      mensagem, corrigido por Andre direto no painel do GHL (Private Integrations). Pipeline de
      envio 100% confirmado, não só documentado.

## ✅ Feito (backend da plataforma — sessão 21 jul 2026)

- [x] **Supabase dev + prod criados e schema aplicado nos dois** — `schema.sql` rodado com
      sucesso (contacts, stage_history, notes, drafts, messages + RLS "authenticated full
      access"). Projetos separados dev/prod por segurança (um envio de teste nunca toca um
      vendedor real).
- [x] **Auth dos 2 operadores** — página `/login` (Supabase `signInWithPassword`, sem signup
      público), clientes browser/server/admin (`lib/supabase/*`), e `proxy.ts` (Next 16, não
      `middleware.ts`) barrando toda rota exceto `/login` e `/api/*`. Os 2 usuários reais já
      criados por Andre no Supabase Auth.
- [x] **`triage_rules.py` portado pra TypeScript** (`platform/lib/triage.ts`) — 17/17 casos do
      self-test batendo, comportamento idêntico ao Python.
- [x] **Webhook `/api/webhooks/ghl`** — segredo compartilhado (`x-webhook-secret`), idempotente
      por `ghl_message_id`, upsert do contato + registro da mensagem + triagem determinística.
      Conservador: nunca auto-negocia (ADR 0003), só encaminha pra fila humana, descarta
      declínios claros, e força "Do Not Contact" em opt-out.
- [x] **3 telas ligadas em dados reais do Supabase** — `fetchLeads` (client server-side com RLS)
      substitui `mock-data.ts`; páginas viraram Server Components. **RLS validado ponta a ponta**:
      anônimo vê 0 contatos, operador logado vê todos.
- [x] **Banco dev semeado** com os 14 leads de exemplo (`scripts/seed-dev.mts`, com trava que
      recusa rodar fora do projeto dev) — plataforma renderiza conteúdo real ponta a ponta.
- [x] **Portão de QA leve (estilo Migaku, enxuto)** — subagente `code-reviewer`
      (`.claude/agents/code-reviewer.md`) rodado antes de push, `wiki/quality-gates.md`, pointer no
      `AGENTS.md`. Já pegou um bug real na 1ª execução (contagem do badge inconsistente com nulos).

## 🚧 Em andamento / parcialmente feito

- [x] **Plataforma hospedada — RETOMADA, frontend-first com dados mock** (ver
      `decisions/0005-plataforma-frontend-first.md`). Feito nesta sessão: scaffold Next.js 16 em
      `platform/`, design system da Claude Design implementado (tokens, AppShell, Badge,
      SellerDossierPanel), e **as 3 telas completas** (Kanban com drag-and-drop, Conversations
      inbox 3 colunas, Leads tabela mestra) — construídas por 3 subagentes em paralelo, mescladas,
      build verde, revisadas visualmente por screenshot. Tudo com dados mock, nenhuma persistência
      real ainda. No GitHub, deployável na Vercel (root directory `platform`).
- [ ] `/opening-script` foi criada mas **ainda não rodou contra um lead real** — próximo passo
      antes de deixar rodando sem supervisão constante (ver plano, verificação do item 1.1).
- [ ] Guia de voz — bom para os dois registros encontrados, mas só cobre 420 mensagens de um
      recorte; precisa de re-extração periódica (a skill `/audit-conversations` já foi estendida
      pra fazer isso, mas ainda não rodou uma segunda vez).

## ❌ Pendente / não iniciado
- [ ] **Env vars do Supabase na Vercel** (bloqueante pro deploy ao vivo funcionar) — as 4 vars
      (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
      `GHL_WEBHOOK_SECRET`) com valores prod no ambiente Production e valores dev no
      Preview/Development, + Redeploy. Depende de Andre (não tenho acesso ao painel da Vercel).
- [ ] **Configurar o webhook no workflow do SwiftScale/GHL** — trigger "Customer Replied" →
      ação Webhook (POST) pra `/api/webhooks/ghl` com header `x-webhook-secret`. Passo conjunto,
      depois que a plataforma estiver no ar.
- [ ] **Escrita de volta ao Supabase** — as telas ainda mutam só estado local do React (drag no
      Kanban, mover pra DNC, etc. não persistem). Próximo bloco: rota de envio + persistir
      mudanças de estágio/atribuição.
- [ ] **Rodar `/triage-inbox` num dia real de respostas** e comparar contra o julgamento manual
      de Andre — depende de respostas novas chegarem.
- [ ] Rotina agendada (schedule skill) — deliberadamente adiada até `/triage-inbox` e
      `/opening-script` serem validados manualmente algumas vezes.
- [ ] Migração de dados do `crm_db.json` local pro Supabase (só relevante quando o backend existir).
- [ ] Avaliar n8n como camada de notificação/plumbing (ex: avisar Andre quando um lead virar
      "Quente") — considerado, não decidido nem construído; não substitui nenhum passo que exige
      julgamento (isso continua sendo trabalho do Claude).

## Perguntas em aberto pro Andre

- **Setar as env vars do Supabase na Vercel + Redeploy** (único bloqueante do lado do Andre pra
  o login + dados funcionarem ao vivo). Valores prod no Production, dev no Preview/Development.
- Depois do deploy ao vivo validado: partir pra escrita de volta (persistir drag do Kanban,
  atribuição, envio de mensagem) ou configurar primeiro o webhook no GHL pra ver resposta real
  entrando na plataforma?
