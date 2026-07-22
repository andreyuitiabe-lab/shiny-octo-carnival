# Log — registro cronológico (append-only)

> Nunca editar uma entrada antiga. Se algo mudou, adicione uma entrada nova referenciando a
> anterior. Formato: `## AAAA-MM-DD — título curto`.

## 2026-07-21 — Backend da plataforma: auth, webhook, triagem em TS, telas em dados reais

Sessão focada em tirar a plataforma do "frontend com mock" e ligá-la num backend real, na
ordem de segurança correta (auth antes de qualquer dado de vendedor entrar).

1. **Supabase dev + prod** criados por Andre; `schema.sql` rodado nos dois (5 tabelas + RLS).
   Chaves passadas pelo chat só pra configurar; `.env.local` (dev) e Vercel (prod) guardam.
2. **Auth dos 2 operadores**: `/login` (Supabase, sem signup público), clientes
   browser/server/admin em `lib/supabase/`, e `proxy.ts` (Next 16 renomeou `middleware.ts`)
   barrando tudo exceto `/login` e `/api/*`. Usuários reais criados por Andre.
3. **`triage_rules.py` → `lib/triage.ts`** — porta fiel, 17/17 casos do self-test batendo.
4. **Webhook `/api/webhooks/ghl`** — segredo compartilhado, idempotente por `ghl_message_id`,
   upsert de contato + mensagem + triagem determinística. Conservador por design (ADR 0003):
   nunca auto-negocia, só encaminha pra fila humana / descarta declínio / força DNC em opt-out.
5. **3 telas ligadas ao Supabase** (`fetchLeads`, RLS-scoped) — mock-data aposentado como fonte.
   RLS validado ponta a ponta (anônimo vê 0, logado vê 14). Banco dev semeado via
   `scripts/seed-dev.mts` (com trava anti-prod).
6. **Portão de QA leve** montado a pedido do Andre (referência: estrutura pm/dev/qa/tech-lead do
   projeto Migaku), mas enxuto pro tamanho: subagente `code-reviewer` + `wiki/quality-gates.md`
   + pointer no `AGENTS.md`. Rodado de verdade sobre o rewiring — pegou um bug de contagem
   (badge vs. aba "needs reply" divergiam em contatos com direção nula), corrigido antes do push.

Pendente do lado do Andre: env vars do Supabase na Vercel + Redeploy. Depois: escrita de volta
(persistir estágio/atribuição/envio) e configurar o webhook no workflow do GHL.

## 2026-07-20 — Wiki criada; consolidação de tudo construído desde 18/07

Sessão longa cobrindo desde o design inicial do CRM até a decisão final de escopo da IA.
Sequência real de decisões (ver `decisions/` pra detalhe de cada uma):

1. Design inicial de um CRM local (`tools/crm_db.py`, `crm_sync.py`, `crm_write.py`,
   `app/crm-kanban.html`, skills `/triage-inbox`, `/lead-agent`, `/send-approved`) — GHL como
   fonte de verdade no começo, depois migrado pra banco local próprio quando ficou claro que
   Andre queria "usar o SwiftScale só como ferramenta de enviar/receber". Ver
   `decisions/0001-swiftscale-transport-only.md`.
2. `/lead-agent` testado contra um lead real (Grigorios Miaris, negociação de lote em Vonore) —
   funcionou, mas revelou um bug (rascunho saiu em português por engano) corrigido na hora.
3. Pedido de virar uma **plataforma hospedada** (Vercel + Supabase + Gemini) pro Andre e o sócio
   acessarem juntos — planejado em detalhe (webhook em vez de polling, banco dev/prod separado,
   segurança, gatilhos de escalonamento) mas **pausado** depois que a auditoria de conversas
   mudou o escopo do que a IA deveria fazer. Ver `decisions/0004-plataforma-pausada.md`.
4. `/audit-conversations` criada e rodada contra as 80 conversas reais do SwiftScale (677
   mensagens) — achou que ~1/4 das conversas não se encaixava nos 8 rumos originais (A-H).
   Rumos novos I/J/K/L/M/Q/P documentados. Ver `audits/2026-07-20-conversation-audit.md`.
5. **Decisão final de escopo**: a IA só abre a conversa (roteiro de 4 passos condicionais,
   `architecture/conversation-flow.md`) e faz a triagem gratuita — negociar e fechar fica 100%
   humano (Andre/sócio). Isso simplificou drasticamente o design (não precisa mais de um "agente
   de negociação autônomo"). Ver `decisions/0003-ia-abre-humano-negocia.md`.
6. `/lead-agent` reescrita de "negociador autônomo" pra "redator sob demanda" — Andre dá a
   intenção, a skill escreve o texto usando a conversa real + o guia de voz.
7. Guia de voz (playbook §6b) extraído de 420 mensagens reais realmente enviadas — dois
   registros (reconhecimento curto / negociação estruturada) + lista de "sinais de artificialidade"
   a evitar.
8. Diagrama do fluxo publicado como artifact (kanban → conversa → roteiro de abertura → handoff
   humano) — atualizado 2x conforme o design mudou.
9. Esta wiki criada, seguindo o padrão de [Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
   + [ADRs](https://adr.github.io/), pra não perder esse contexto entre sessões.

## 2026-07-20 — Fase 1 do plano de implementação: 3 de 5 itens fechados

Plano de implementação em 2 fases aprovado (Fase 1 local, Fase 2 plataforma revisada — ver
`status.md` e o histórico do plano). Trabalho delegado a 3 subagentes em paralelo; 1 completou
sozinho, 2 travaram no meio (sem progresso por 10 min) e foram finalizados manualmente a partir
do que já tinham produzido:

1. **`tools/triage_rules.py` corrigido** — novo bucket `possible_rumo_j`: preço extremo (≥$1M)
   ou com frase de dispensa explícita ("walk away", "never pay") não vira mais sinal quente
   automático, mas também nunca auto-descarta — só sinaliza pra revisão humana. Self-test
   passando (incluindo os casos reais Ray Mccord/Carl Katims que motivaram a correção).
2. **Skill `/opening-script` criada** — a peça que faltava pra tornar o roteiro §1c executável
   de verdade (antes só existia como desenho no playbook). É a única automação do sistema
   inteiro com permissão de enviar SMS sem aprovação humana por mensagem — limite estrito, para
   no primeiro sinal de negociação. Linkada de dentro do `/triage-inbox`.
3. **Instrução de delegação Haiku corrigida** — um subagente dedicado auditou a seção "Cost
   note" de `/triage-inbox` e achou duas lacunas reais: faltava `run_in_background: false`
   (risco de seguir pro relatório sem esperar o resultado) e a exigência de o prompt do
   sub-agente ser autocontido (ele nasce sem memória da sessão). Corrigido.

Ainda pendente da Fase 1: testar `/send-approved` com envio real (bloqueado — falta o telefone
do Andre) e validar `/triage-inbox`/`/opening-script` contra respostas reais de um dia (depende
de disparo novo). Pergunta lateral sobre usar n8n como camada de notificação (não decidida, não
construída — ver `status.md`).

## 2026-07-20 — `/send-approved` validado com envio real (item 1.3 fechado)

Andre passou o número (+19712669323) e pediu pra testar o envio de verdade. Primeira tentativa:
`401 "The token is not authorized for this scope"` — o token do GHL só tinha escopos de leitura
(configurados no setup original, `swiftscale-api-guide.html`), nunca teve escrita de mensagem.
Andre adicionou a permissão faltante direto no painel (Private Integrations) sem precisar gerar
token novo — segunda tentativa retornou sucesso (`conversationId`/`messageId`, sem erro), e Andre confirmou o
recebimento real no celular. Esse é o primeiro envio ponta a ponta confirmado desde que o
pipeline foi desenhado — **item 1.3 do plano de implementação fechado por completo.** Da Fase 1
só resta o item 1.4 (validar `/triage-inbox`/`/opening-script` contra um dia real de respostas),
que depende só de tempo/disparo novo, não de nenhuma decisão pendente.

## 2026-07-20 — Plataforma retomada; UI completa das 3 telas construída (frontend-first)

Andre pediu o design inicial via Claude Design e recebeu um handoff de alta fidelidade
(`design_handoff_parcel_crm/`). Com contas Vercel/Supabase já existentes e o repo no GitHub
(`andreyuitiabe-lab/shiny-octo-carnival`), retomamos a plataforma que estava pausada — decisão
registrada em `decisions/0005-plataforma-frontend-first.md` (continua a 0004). Construído nesta
sessão:

1. Scaffold Next.js 16 (App Router, TS) em `platform/` + rota de diagnóstico
   `/api/cloudflare-check` (o risco do Cloudflare no serverless ainda precisa ser validado na
   Vercel de verdade — bloqueante pra backend).
2. Fundação compartilhada: design tokens da Claude Design em `globals.css`, `lib/types.ts`
   espelhando `crm_db.py`, `lib/mock-data.ts` (14 leads traduzidos do protótipo), `AppShell`,
   `Badge`, `SellerDossierPanel`, `lib/wait.ts` (indicador "quem deve resposta").
3. As 3 telas, construídas por 3 subagentes em paralelo (worktrees isolados, uma rota cada),
   mescladas uma a uma com build verde e revisadas por screenshot: **Kanban** (7 lanes,
   drag-and-drop dnd-kit, "Ready for Research" destacada), **Conversations** (inbox 3 colunas,
   3 estilos de mensagem, seletor de estágio, dossiê togglável), **Leads** (tabela mestra
   ordenável, stats, tabs All/DNC, bulk actions, CSV export, detail drawer).

Tudo com dados mock, estado só local do React — nenhuma persistência real ainda. Próximo passo
bloqueado por Andre: conectar o repo na Vercel + env vars pra validar o Cloudflare, depois o
backend (Supabase, auth, webhook). O motor de negociação via Gemini continua fora de escopo
(decisão 0003) — o dossiê é sempre pull manual, negociação é digitada pelos humanos.

## 2026-07-21 — Polimento de UI + filtros funcionais + schema do Supabase pronto

Iterando sobre a UI com Andre (tudo em `platform/`, ainda com dados mock):

1. **Tela de conversas com proporções melhores** — as 3 barras empilhadas (header + wait +
   estágio) viraram header enxuto + uma faixa de controle; mensagens agora numa coluna central
   de ~860px (estilo Telegram/iMessage). Andre tinha achado a área de conversa pequena demais.
2. **Clicar num card do Kanban abre a conversa** daquela pessoa (`/conversations?lead=<id>`),
   distinguindo clique de arraste pelo movimento do ponteiro.
3. **Filtros funcionais nas 3 telas** — eram placeholders visuais. Novo componente compartilhado
   `FilterDropdown` + `lib/filters.ts`. Depois, a pedido do Andre, convertidos pra
   **multi-seleção** (checkboxes): dá pra puxar "todos os não-descartados" marcando várias
   classificações de uma vez. Dentro de um filtro os valores somam (OR), entre filtros cruzam
   (AND). Sort continua seleção única.
4. **Correções de hidratação** — timestamps relativos passaram a usar um `REFERENCE_NOW` fixo
   (`lib/now.ts`) e formatação com timezone UTC pinada; o card do Kanban usa `useHydrated()`
   (`useSyncExternalStore`) pra só aplicar os atributos do dnd-kit depois da hidratação. Sem
   isso, o dnd-kit e os horários causavam mismatch servidor/cliente.
5. **Schema do Supabase pronto** (`platform/supabase/schema.sql` + README) — tabelas contacts/
   stage_history/notes/drafts/messages espelhando `crm_db.py`/`lib/types.ts`, com enums, índices,
   trigger de updated_at, e RLS (workspace compartilhado, 2 operadores, sem signup público).
   Adiantado agora porque é idêntico independente do resultado do Cloudflare; só não rodou ainda
   (depende de Andre criar os 2 projetos dev/prod).

Continua bloqueado no mesmo ponto: Andre precisa fazer o deploy na Vercel (Root Directory
`platform` + as 2 env vars do GHL) pra eu validar `/api/cloudflare-check`. Só depois disso o
mecanismo de sync (webhook vs polling) é decidido e construído.

## 2026-07-21 — Risco do Cloudflare descartado na Vercel (destrava o backend)

Andre deployou a plataforma na Vercel (Root Directory `platform`, env vars `GHL_API_TOKEN`/
`GHL_LOCATION_ID`, e desligou a Deployment Protection pra a rota ficar acessível). Rodei
`/api/cloudflare-check` no deploy real → `ok: true`, JSON válido do GHL. **O `fetch` serverless
da Vercel NAO e bloqueado pelo Cloudflare** (diferente do Python urllib/requests local). Isso
resolve a unica incognita tecnica que travava toda a Fase 2 — o webhook e viavel, sem precisar
de caminho alternativo de polling. Proximo: construir `/api/webhooks/ghl` + Supabase + auth dos
2 usuarios. Ver `decisions/0002-webhook-vs-polling.md` (resolucao do risco aberto).
