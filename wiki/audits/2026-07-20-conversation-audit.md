# Auditoria de conversas — 20 jul 2026

**Executada por**: skill `/audit-conversations`, primeira rodada.
**Escopo**: 80 conversas reais (todos os contatos com opportunity ativa na "SMS Marketing
Pipeline"), 677 mensagens, thread completa lida (não só última mensagem).

## Resultado quantitativo

| Rumo | Contagem aproximada |
|---|---|
| A. Silêncio | 3 |
| B. Opt-out/STOP | 0 nesta amostra (GHL trata sozinho) |
| C. Recusa dura | ~8 |
| D. Recusa com motivo | ~3 |
| E. Número errado | 0 nesta amostra |
| F. Âncora de preço firme | ~12 |
| G. Engajando sem preço | ~15 |
| H. Negociação ativa | ~20 |
| **Não se encaixava em A-H** | **~19 (quase 1/4)** |

## Rumos novos propostos e aceitos (agora em playbook §1b)

Ver `../reference/conversation-trajectories.md` pra tabela resumida; playbook §1b tem os
exemplos verbatim completos. Resumo: I (acordo→contrato), J (preço extremo como recusa — quebra
a regra geral de prioridade de preço), K (pede verificação de legitimidade), L (terceiro decide:
cônjuge/advogado/corretor), M (adiamento com data), Q (recusa SMS, quer ligação/presencial), P
(vendedor comercial sofisticado, baixa confiança/2 casos).

## Achado que mudou a arquitetura

O padrão J (preço absurdo/irônico como recusa educada) **quebra a premissa central** do filtro
determinístico (`triage_rules.py`): "preço sempre vence palavra negativa, nunca auto-descarta".
Exemplos reais: "$25,000,000... we will walk away" (Ray Mccord, terreno comum); "$2M" → depois de
perguntado, "It's an animal refuge, $3M" (Carl Katims/Jeffrey Diedrich). Isso não foi corrigido
no código do `triage_rules.py` ainda — só documentado no playbook como exceção manual. **Pendência
em `../status.md`.**

## Achado que mudou o escopo do produto inteiro

A quantidade e a nuance dos rumos I/J/K/L/M/Q/P foi o argumento decisivo pra Andre fechar a
decisão `../decisions/0003-ia-abre-humano-negocia.md` — negociação e fechamento ficam 100%
humanos, a IA só abre conversa. Sem essa auditoria rodada ANTES de construir a plataforma, o
motor de negociação autônomo teria sido construído em cima de um framework de rumos incompleto.

## Achados sobre o roteiro de abertura (coaching, não rumo)

- Perguntar zoneamento/utilidades quando é registro público irritou 2 vendedores reais (Tyler
  Green, David Wells) — motivou a regra "só pergunta o que a API não sabe" no playbook §1c.
- A pergunta de "outros lotes" só rendeu quando formulada como afirmação de um dado já conhecido
  ("vi que você tem 3 lotes"), nunca como pergunta genérica — motivou tornar esse passo
  condicional em vez de automático.
- O pitch de 1031 exchange aparece cedo demais em várias conversas reais — cortado do roteiro
  automático, vira ferramenta manual.

## Guia de voz (extra desta sessão, não desta auditoria formalmente, mas relacionado)

420 mensagens outbound reais analisadas separadamente pra construir o guia de voz (playbook
§6b) — ver `../reference/voice-guide.md`.
