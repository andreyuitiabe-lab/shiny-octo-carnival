# Status — feito vs. pendente

> Atualizado a cada sessão relevante (pela skill `/wiki-update` ou manualmente). Não é um
> histórico — para isso veja `log.md`. Isso aqui é só "onde estamos agora".

## ✅ Feito

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
- [ ] **Validar o Cloudflare na Vercel** — a rota `/api/cloudflare-check` existe e funciona
      local, mas o teste que importa (o `fetch` serverless da Vercel é bloqueado como o Python
      urllib?) só vale rodado na Vercel de verdade. **Bloqueante** pra qualquer código da
      plataforma que fale com o GHL. Depende de Andre conectar o repo na Vercel (Root Directory
      `platform`) + setar as env vars `GHL_API_TOKEN`/`GHL_LOCATION_ID`. (Em andamento — Andre
      está fazendo o deploy.)
- [ ] **Backend da plataforma** — auth dos 2 usuários no Supabase, porta de `triage_rules.py`
      pra TypeScript, mecanismo de sync (webhook vs polling — decidido após o Cloudflare). O
      **schema do Supabase já está pronto** (`platform/supabase/schema.sql` + README), só falta
      Andre criar os 2 projetos (dev/prod) e rodar. As telas hoje mutam só estado local do React.
- [ ] **UI da plataforma** (feito nesta sessão, mas ainda com dados mock): 3 telas + dossiê +
      filtros multi-seleção funcionais + navegação Kanban→conversa. Falta só ligar em dados reais
      quando o backend existir.
- [ ] **Rodar `/triage-inbox` num dia real de respostas** e comparar contra o julgamento manual
      de Andre — depende de respostas novas chegarem.
- [ ] Rotina agendada (schedule skill) — deliberadamente adiada até `/triage-inbox` e
      `/opening-script` serem validados manualmente algumas vezes.
- [ ] Migração de dados do `crm_db.json` local pro Supabase (só relevante quando o backend existir).
- [ ] Avaliar n8n como camada de notificação/plumbing (ex: avisar Andre quando um lead virar
      "Quente") — considerado, não decidido nem construído; não substitui nenhum passo que exige
      julgamento (isso continua sendo trabalho do Claude).

## Perguntas em aberto pro Andre

- Conectar o repo na Vercel (root directory `platform`) + setar `GHL_API_TOKEN`/`GHL_LOCATION_ID`
  pra eu poder validar o Cloudflare de verdade — quando puder fazer isso?
- Depois da UI validada, seguir pro backend (Supabase + auth + webhook) ou ajustar algo nas
  telas primeiro?
