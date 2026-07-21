# Referência — catálogo de skills

Todas em `~/.claude/skills/<nome>/SKILL.md` (fora deste repo, no config do Claude Code do Andre).

| Skill | O que faz | Nunca faz | Modelo recomendado |
|---|---|---|---|
| `/seller-dossier` | Pesquisa completa de UM lead: parcela, satélite, diligência, valuation, 3 números de oferta. Sempre acionada manualmente por Andre. | Não é acionada automaticamente por nenhuma outra skill/estágio. | Sonnet 5 (Opus em deals >$500k) |
| `/audit-conversations` | Lê TODAS as conversas reais (thread completa), testa contra os rumos A-Q, propõe atualizações ao playbook (rumos novos + guia de voz). Reutilizável, roda de novo periodicamente. | Nunca edita o playbook diretamente — sempre propõe, Andre aprova. | Sonnet 5 |
| `/triage-inbox` | Roda `crm_sync.py`, classifica a fila "precisa_ia" que sobrou do filtro determinístico, depois dispara `/opening-script` pra quem engajou de verdade. | Não decide estágio além do que a triagem implica; não envia SMS diretamente. | **Haiku 4.5**, delegado via sub-agente síncrono (`run_in_background: false`, prompt autocontido — ver "Cost note" na skill) |
| `/opening-script` | **A única automação que envia SMS sem aprovação humana por mensagem.** Roda o roteiro §1c (lote → zoneamento/estrutura → outros lotes se indicado → motivação) pra quem acabou de engajar por real. | Nunca discute preço/prazo/negociação; nunca roda mais de uma rodada por invocação; para no primeiro rumo I/J/K/L/M/Q. | Sonnet 5 |
| `/lead-agent` | **Redator sob demanda.** Andre dá a intenção (contra-oferta, recusa educada, pedir prazo), a skill escreve o texto usando a conversa real + guia de voz. | Nunca escolhe a estratégia sozinha, nunca envia, nunca inventa número/comp. | Sonnet 5 |
| `/send-approved` | Único ponto que efetivamente manda SMS. Lista rascunhos pendentes, Andre aprova um a um. | Nunca envia sem aprovação explícita por mensagem. | Sonnet 5 (curto e de baixo volume, não vale a pena delegar) |

## Histórico de mudança de escopo

`/lead-agent` já teve DUAS versões:
1. **Original** (18 jul) — tentava negociar autonomamente até "prontidão pra proposta", decidindo
   sozinha quando acionar `/seller-dossier`. Rejeitada.
2. **Atual** (20 jul, ver `../decisions/0003-ia-abre-humano-negocia.md`) — redator sob demanda,
   Andre decide a estratégia, a skill só escreve.

Se encontrar documentação ou memória referenciando a versão 1, está desatualizada.
