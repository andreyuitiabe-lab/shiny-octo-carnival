<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Quality gates before every push

Andre is a non-coder — the QA gate is the safety net. Before committing any change
that touches `platform/`, run the gates in `wiki/quality-gates.md`:
1. `npm run build` + `npm run lint` clean.
2. Run the `code-reviewer` subagent (`.claude/agents/code-reviewer.md`) on the diff;
   verdict must be APROVADO / APROVADO COM RESSALVAS before pushing.
3. Update `wiki/status.md` + `wiki/log.md` if something durable changed.
