# Arquitetura — fluxo de conversa (do disparo ao fechamento)

Diagrama publicado (kanban macro + zoom no roteiro de abertura):
**https://claude.ai/code/artifact/f1ad770c-5554-49d1-86d1-b5250a75a206**

## Visão macro

```
Disparo em massa → sequência de abertura automática (3 msgs) → seller responde?
   não → fica em "Novo" + 1 lembrete automático
   sim → filtro determinístico (triage_rules.py)
       → STOP/opt-out            → Não incomodar
       → recusa dura/com motivo  → Descartado
       → número errado           → Descartado + tag
       → sinal de preço/ambíguo  → fila "Precisa de você"

fila "Precisa de você" → Andre/sócio leem a conversa real
   → precisa de dados? → pede /seller-dossier manualmente → usa o relatório
   → negociam por SMS direto (usando /lead-agent como redator, se quiser)
   → preço convergiu → Proposta enviada/Negociando → Sob contrato → Fechado
   → esfriou → Descartado
```

## O roteiro de abertura (o que a IA pode fazer sozinha)

Definido em `SELLER-DOSSIER-PLAYBOOK.md §1c`. Resumo — 4 passos, cada um condicional, nunca
discute preço/prazo/negociação:

1. **Confirma o lote** — só se ambíguo (a maioria das conversas não precisou disso).
2. **Zoneamento + estrutura + utilidades, numa mensagem só** — só o que a API do parcel (§2 do
   playbook) não sabe. Perguntar o que é registro público irritou vendedores reais (2 casos na
   auditoria).
3. **Menciona outros lotes** — só se a API ou o próprio vendedor já indicou que existe mais de
   um. Nunca pergunta às cegas ("você tem outros lotes?") — os casos de maior valor na auditoria
   foram o Felipe *afirmando* um dado que já tinha ("vi que você tem 3 lotes ali do lado"), não
   perguntando genericamente.
4. **Motivação** — "por que pensando em vender agora?" — pergunta central do playbook (Land
   Academy) que o roteiro antigo quase nunca fazia.

No primeiro sinal de preço, prazo, ou qualquer rumo I/J/K/L/M/Q (ver
`../reference/conversation-trajectories.md`), o roteiro **para** e o contato vai pra fila humana.

## Por que essa divisão (IA abre, humano negocia)

Ver `../decisions/0003-ia-abre-humano-negocia.md` — decisão central, motivada pela auditoria de
conversas reais.

## Status de implementação

O roteiro acima agora existe como skill executável (`~/.claude/skills/opening-script/SKILL.md`),
disparada de dentro do ciclo do `/triage-inbox`. Ainda não rodou contra um lead real — ver
`../status.md` pra essa validação pendente antes de deixar rodando sem supervisão.
