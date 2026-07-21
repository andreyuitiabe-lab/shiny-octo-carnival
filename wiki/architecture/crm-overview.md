# Arquitetura — CRM local

## Peças e como se conectam

```
SwiftScale (GHL) ──curl──► tools/crm_sync.py ──► tools/output/crm_db.json (nosso banco)
                                  │                        ▲
                                  ▼                        │
                          tools/triage_rules.py    tools/crm_write.py (CLI de escrita)
                          (filtro zero-IA)                 ▲
                                                            │
                          skills: /triage-inbox, /lead-agent, /send-approved
                                                            │
                                                            ▼
                                              app/crm-kanban.html (viewer, drag-and-drop)
```

## Por que existe um banco local em vez de usar o GHL direto

Ver `../decisions/0001-swiftscale-transport-only.md`. Resumo: Andre quer controle total do funil
sem depender do modelo de dados do GHL, e uma base que eventualmente dá pra compartilhar.

## `tools/crm_db.py` — schema

- **`STAGE_ORDER`**: funil próprio (Novo → Precisa triagem → Morno/Quente → Em qualificacao →
  Proposta pronta/enviada → Negociando → Sob contrato → Fechado, mais Descartado/Nao incomodar).
  Independente dos nomes de estágio do GHL.
- **`AUTO_STAGES`**: quais estágios o sync pode mudar sozinho sem intervenção humana — protege
  contra rebaixar um contato que já foi trabalhado manualmente. Testado e confirmado funcionando.
- Por contato: `contact_id`, `conversation_id`, `name`, `phone`, `tags`, `our_stage`,
  `stage_history` (log de mudanças), `last_message_*`, `triage` (bucket/motivo/fonte), `notes`,
  `drafts` (rascunhos com status pending/approved/sent/rejected).

## `tools/crm_sync.py` — descoberta de contatos

**Achado importante**: `conversations/search` sozinho retorna ~4500 contatos (todo mundo já
texteado, a maioria nunca respondeu). Em vez disso, usamos `opportunities/search` na pipeline
"SMS Marketing Pipeline" como índice — o GHL só cria uma opportunity quando alguém **responde de
verdade**, então isso já filtra pra ~70-80 contatos relevantes. O sync usa esse índice só pra
descobrir QUEM sincronizar, nunca lê o `pipelineStageId` do GHL como estágio de verdade (esse
seria o modelo de dados do GHL, que decidimos não usar).

**Cloudflare**: todo acesso à API do GHL é via `curl` em subprocess — Python `urllib`/`requests`
são bloqueados pelo Cloudflare dessa conta (confirmado, ver playbook §0). O `curl_get` tem
retry/backoff porque requisições em sequência rápida ocasionalmente batem num desafio do
Cloudflare (não é falta de escopo, é rate-limit-like).

## `app/crm-kanban.html`

Single-file HTML, mesmo padrão visual do resto do toolkit (`app/lead-manager.html` etc — tema
escuro, sem build step). Lê `crm_db.json` via drag-and-drop de arquivo (não fetch — evita
problemas de CORS com `file://`). Drag-and-drop entre colunas grava só em localStorage do
navegador; pra persistir de verdade tem um botão "Exportar crm_db.json" que sobrescreve o
arquivo real.

## Catálogo completo de skills

Ver `../reference/skills-catalog.md`.
