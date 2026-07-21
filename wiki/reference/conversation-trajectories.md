# Referência — os rumos de conversa (A–Q)

**Fonte de verdade**: `SELLER-DOSSIER-PLAYBOOK.md §1b`. Esta página é um resumo de navegação —
pra critério exato de classificação e regra de prioridade (preço sempre checado antes de
palavra-chave negativa), leia o playbook.

## Os originais (A–H, do design inicial, ~12 exemplos)

| # | Rumo | Ação |
|---|---|---|
| A | Silêncio | Nenhuma ação, não é "resposta" |
| B | Opt-out/STOP | Não incomodar — GHL já suprime sozinho |
| C | Recusa dura, sem motivo | Descartado |
| D | Recusa com motivo | Descartado, guarda o motivo |
| E | Número errado | Descartado + tag `wrong-number` |
| F | Contra-âncora/oferta concorrente | Fila humana, urgente, comps-first |
| G | Engajando sem preço | Fila humana, nutrir |
| H | Negociação ativa | Fila humana, nunca fechar como recusa |

## Os novos (I–Q, achados na auditoria de 80 conversas reais — ver `../audits/2026-07-20-conversation-audit.md`)

| # | Rumo | Ação |
|---|---|---|
| I | Acordo fechado, indo pra contrato | Humano cuida da logística (título, advogado) |
| J | **Preço extremo/irônico como recusa** | Descartado — exceção à regra "preço nunca é recusa" |
| K | Pede verificação de legitimidade | Humano responde |
| L | Terceiro decide (cônjuge/advogado/corretor) | Humano negocia, economia de comissão pode mudar |
| M | Adiamento com data específica | Lembrete agendado, não resposta imediata |
| Q | Recusa SMS, quer ligação/presencial | Escalonamento imediato |
| P | Vendedor comercial sofisticado (baixa confiança, 2 casos) | Humano, watch-list |

**A exceção mais importante**: rumo J quebra a regra geral "preço sempre vence palavra negativa".
Um preço *ordens de grandeza* acima de qualquer comp real, com tom sarcástico, é recusa
disfarçada — não fila quente. Ver playbook §1b pra exemplos reais.

## Metodologia

Auditoria feita lendo as 80 conversas (677 mensagens) inteiras, não só a última mensagem — a
classificação por thread completa é o que revelou I/J/K/L/M/Q/P, que um filtro de última-mensagem
nunca pegaria. Reproduzível via skill `/audit-conversations`.
