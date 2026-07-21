# 0003 — A IA só abre a conversa; negociar e fechar é 100% humano

**Status:** aceito · **Data:** 2026-07-20 · **Supera:** a ideia original de um "agente de
negociação autônomo" descrita nas primeiras versões da skill `/lead-agent`.

## Contexto

O design inicial (e a arquitetura da plataforma planejada em [0004](0004-plataforma-pausada.md))
previa um agente (Gemini ou Claude) que qualificava o lead por SMS até apurar motivação/prazo/
preço, e só então acionava a pesquisa (`/seller-dossier`) e entregava pronto pra Andre aprovar o
envio. Antes de construir isso, rodamos `/audit-conversations` contra as 80 conversas reais do
SwiftScale (ver `../audits/2026-07-20-conversation-audit.md`). O achado central: quase 1/4 das
conversas reais envolvia nuance que um agente autônomo dificilmente arbitraria bem — preço
extremo usado como recusa irônica (rumo J), terceiro decidindo (cônjuge/advogado/corretor com
comissão — rumo L), vendedor que só fecha por ligação ou presencial (rumo Q), acordo já
convergido indo pra logística de contrato/advogado (rumo I). Diante disso, Andre definiu: *"quero
que a ia só começasse as conversas. para negociar e fechar o negocio a gente assume."*

## Decisão

- A IA só faz duas coisas: (1) dispara a sequência de abertura (3 mensagens fixas) e (2) roda o
  roteiro de abertura condicional de 4 passos — confirma lote (se ambíguo) → zoneamento/estrutura
  numa mensagem só (só o que a API do parcel não sabe) → outros lotes (só se o dado já indicar,
  nunca pergunta às cegas) → motivação. Ver `../architecture/conversation-flow.md`.
- No primeiro sinal de preço, prazo, negociação, ou qualquer um dos rumos I/J/K/L/M/Q, a
  automação PARA e o contato vai pra fila "Precisa de você" — dali em diante é 100% Andre/sócio
  respondendo direto.
- O relatório (`/seller-dossier`) nunca é disparado automaticamente — é pedido manualmente por
  Andre/sócio no momento em que sentirem que precisam de dado pra responder.
- `/lead-agent` deixou de ser um "negociador autônomo" e virou um **redator sob demanda**: Andre
  dá a intenção (ex: "contra de 60k citando os comps"), a skill escreve o texto usando a conversa
  real + o guia de voz (`../reference/voice-guide.md`) — nunca decide sozinha o que oferecer.

## Consequências

- Ganha: risco muito menor de a IA falar besteira numa negociação de dinheiro real; design mais
  simples (sem motor de negociação, sem inferência de "prontidão pra proposta"); a plataforma
  hospedada também fica mais simples se for retomada (sem `/api/leads/[id]/draft` de negociação).
- Perde: menos automação de ponta a ponta — Andre/sócio precisam efetivamente conversar com todo
  mundo que morder a isca (pela amostra, ~35-45 de 80 conversas tinham engajamento real).
- Esta decisão torna o design da plataforma em [0004](0004-plataforma-pausada.md) parcialmente
  obsoleto (a parte de negociação via Gemini não se aplica mais) — se a plataforma for retomada,
  revisar aquele plano à luz desta decisão antes de construir.
