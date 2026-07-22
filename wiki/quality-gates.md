# Quality Gates — plataforma Parcel CRM

Inspirado no `wiki/agents/workflow.md` do projeto Migaku, mas **enxuto** para o
tamanho desta plataforma (3 telas + webhook). Andre não revisa código, então o
portão de qualidade é a rede de segurança. Nenhum push de código deve pular estes
passos.

## Os gates (antes de todo commit que toca `platform/`)

### Gate 1 — Mecânico
- [ ] `cd platform && npm run build` sem erro
- [ ] `npm run lint` sem erro

### Gate 2 — Revisão
- [ ] Rodar o subagente **`code-reviewer`** (`.claude/agents/code-reviewer.md`)
      sobre o diff. Veredicto tem que ser APROVADO ou APROVADO COM RESSALVAS.
      REPROVADO → corrigir e repassar.

### Gate 3 — Conhecimento (wiki)
- [ ] Se mudou algo durável (nova decisão, novo módulo, um risco resolvido):
      `wiki/status.md` e `wiki/log.md` atualizados; ADR novo se foi decisão de
      arquitetura. Mudança trivial não exige entrada.

## Não-negociáveis que o `code-reviewer` sempre checa

1. Segredo nunca vai pro bundle do cliente (service-role key, token do GHL,
   webhook secret são server-only; `admin.ts` nunca importado de Client Component).
2. Leitura roda como o usuário (anon + RLS); service-role só no webhook e na rota
   de envio.
3. SwiftScale/GHL é só transporte — verdade mora no Supabase.
4. IA abre conversa, humano negocia (ADR 0003) — nada auto-negocia.
5. Pegadinhas do Next 16: `searchParams`/`cookies()`/`params` são async;
   auth em `proxy.ts`, não `middleware.ts`.
6. Webhook: segredo checado antes de tudo; idempotente por `ghl_message_id`.

## Por que enxuto (e não o pipeline completo do Migaku)

Escolha registrada com Andre (21 jul 2026): portão de QA leve em vez de papéis
PM/tech-lead/dev/qa + worktrees. A plataforma é pequena demais para justificar o
overhead; as duas peças que mais importam do Migaku já existem aqui — a wiki com
ADRs e o build+lint automáticos. Se a plataforma crescer muito, revisitar e
promover para o pipeline completo (definições `.claude/agents/` para tech-lead e
dev, cadeia antes de merge, worktrees para paralelismo).
