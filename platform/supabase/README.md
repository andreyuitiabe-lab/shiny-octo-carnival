# Supabase setup

Two projects: **dev** and **prod** (never point the dev build at prod data — a test
"send" during development could otherwise text a real seller). Run `schema.sql` in each.

## Steps (per project)

1. Create the project at supabase.com (free tier is fine for this volume).
2. Open **SQL Editor** → paste `schema.sql` → Run. Creates the tables, enums, indexes,
   the `updated_at` triggers, and Row Level Security policies.
3. **Auth**: Authentication → Providers → keep Email on; Authentication → Providers /
   Sign In → **turn OFF public sign-ups** (this is a 2-person internal tool, not a
   public app). Create the two operator users manually (Authentication → Users → Add user):
   Andre + sócio.
4. Grab the keys (Project Settings → API) for the Vercel env vars:
   - `SUPABASE_URL` — the Project URL
   - `SUPABASE_ANON_KEY` — the anon/public key (client-side, constrained by RLS)
   - `SUPABASE_SERVICE_ROLE_KEY` — the service_role key (⚠️ server-only: webhook handler
     and send route; **never** ship it to the browser bundle)

## Not done yet (waits on the Cloudflare validation)

The sync mechanism that fills these tables from GHL — webhook (preferred) or a polling
fallback — is only decided after `/api/cloudflare-check` confirms whether Vercel's
serverless `fetch` can reach the GHL API. See `wiki/decisions/0002-webhook-vs-polling.md`
and `0004-plataforma-pausada.md`. The schema here is identical either way, so it's safe
to set up now.
