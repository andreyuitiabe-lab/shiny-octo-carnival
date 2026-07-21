# 0001 — SwiftScale é só transporte de SMS, não fonte de verdade

**Status:** aceito · **Data:** 2026-07-18

## Contexto

O primeiro design do CRM tratava o pipeline nativo do GoHighLevel/SwiftScale ("SMS Marketing
Pipeline": Responded → Hot Lead → Offer Given → ... → Do not Contact) como fonte de verdade —
o kanban só refletia o estágio/tags/notas de lá. Andre corrigiu isso: "minha ideia é a gente
criar o nosso próprio sistema para isso usando o swift scale como ferramenta para enviar e
receber mensagens". A intenção era ter controle total do funil (estágios próprios, triagem,
histórico) sem depender do modelo de dados/UI do GHL, e mais tarde permitir acesso compartilhado
(Andre + sócio) sem ficar preso à conta do SwiftScale.

## Decisão

- Banco próprio local (`tools/crm_db.py` → `tools/output/crm_db.json`, gitignored) é a fonte de
  verdade de estágio, triagem, notas e rascunhos.
- `tools/crm_sync.py` só LÊ do GHL (mensagens novas, via as opportunities como índice barato de
  "quem tem conversa ativa" — GHL só cria isso quando alguém responde, o que evita escanear as
  ~4500 conversas totais da conta).
- Funil próprio definido em `tools/crm_db.py::STAGE_ORDER`, independente dos nomes de estágio do
  GHL.
- `AUTO_STAGES` protege contra o sync rebaixar um contato que um humano/skill já avançou
  manualmente (testado: mover um contato pra "Em qualificacao" e rodar o sync de novo não volta
  o estágio).

## Consequências

- Ganha: controle total, nenhuma dependência da UI/modelo de dados do GHL, base pronta pra
  eventualmente compartilhar entre 2 pessoas.
- Perde: precisa manter esse banco por conta própria (sem backup point-in-time nativo enquanto
  for só um arquivo JSON local).
- Esta decisão foi parcialmente superada por [0004](0004-plataforma-pausada.md) (tentativa de
  levar esse banco pro Supabase) e pela mudança de escopo em [0003](0003-ia-abre-humano-negocia.md)
  — mas o princípio "GHL é só transporte" continua valendo em qualquer versão.
