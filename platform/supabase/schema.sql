-- Parcel CRM — Supabase (Postgres) schema.
--
-- Mirrors the app data model in platform/lib/types.ts, which itself mirrors the
-- local toolkit's tools/crm_db.py. SwiftScale/GHL is transport only — stage,
-- triage, notes, drafts, and message history all live HERE, not in GHL.
-- See wiki/decisions/0001-swiftscale-transport-only.md and 0004-plataforma-pausada.md.
--
-- Run this in the Supabase SQL editor (or via the CLI) once per project — create
-- TWO projects, dev and prod, and run it in each (wiki/decisions security note:
-- never point the dev build at the prod DB, so a test "send" can't hit a real seller).
--
-- Auth model: exactly two operators (Andre + sócio), no public signup. Every
-- table is readable/writable only by authenticated users (RLS below). It is NOT
-- multi-tenant — it's one shared workspace, so any authenticated user sees
-- everything. The service_role key (server-only: webhook handler, send route)
-- bypasses RLS; the anon key (client) is constrained by it.

-- ── Enums ────────────────────────────────────────────────────────────────────
-- Our own funnel (tools/crm_db.py::STAGE_ORDER). English UI copy per the design
-- handoff; the Kanban groups these 12 into ~7 macro lanes in the app layer.
create type stage as enum (
  'New',
  'Needs Triage',
  'Engaging',
  'Negotiating',
  'Qualifying',
  'Ready for Research',
  'Proposal Ready',
  'Proposal Sent',
  'Under Contract',
  'Closed',
  'Discarded',
  'Do Not Contact'
);

-- Deterministic triage buckets from tools/triage_rules.py (kept as text, not an
-- enum, so adding a bucket later doesn't require an enum migration — the app's
-- badgeForBucket() is the source of truth for how these render).
-- Known values: hot_lead_candidate, needs_ai, possible_rumo_j, cancelled,
-- cancelled_wrong_number, do_not_contact.

create type message_direction as enum ('inbound', 'outbound');

-- Who sent an outbound message / who a lead is assigned to. 'automation' is the
-- opening-script; 'a'/'b' are the two human operators.
create type sender_kind as enum ('automation', 'a', 'b');

-- ── contacts ─────────────────────────────────────────────────────────────────
-- One row per lead. Flat columns (not nested json) so we can index and filter
-- (e.g. where our_stage = 'Ready for Research') directly.
create table contacts (
  id uuid primary key default gen_random_uuid(),
  ghl_contact_id text unique not null,      -- the GHL/SwiftScale contact id
  ghl_conversation_id text,                 -- the GHL conversation id
  name text,
  phone text,
  tags jsonb not null default '[]',
  our_stage stage not null default 'New',
  assigned_to sender_kind,                  -- null = unassigned
  unread_count int not null default 0,
  last_message_body text,
  last_message_direction message_direction,
  last_message_at timestamptz,
  triage_bucket text,                       -- one of triage_rules.py's buckets, or null
  triage_matched text,                      -- the token/keyword that matched
  triage_reason text,
  triage_source text,                       -- 'rule' | 'ai'
  triage_classified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_stage_idx on contacts (our_stage);
create index contacts_triage_idx on contacts (triage_bucket);
create index contacts_last_msg_idx on contacts (last_message_at desc);

-- ── stage_history ────────────────────────────────────────────────────────────
-- Append-only audit of stage changes (mirrors crm_db.py's stage_history array).
create table stage_history (
  id bigint generated always as identity primary key,
  contact_id uuid not null references contacts (id) on delete cascade,
  stage stage not null,
  reason text,
  at timestamptz not null default now()
);
create index stage_history_contact_idx on stage_history (contact_id, at);

-- ── notes ────────────────────────────────────────────────────────────────────
-- Internal notes shown inline in the conversation timeline (triage notes,
-- seller-dossier summaries, etc). `author` = 'triage-inbox' | 'opening-script' |
-- 'seller-dossier' | a human operator.
create table notes (
  id bigint generated always as identity primary key,
  contact_id uuid not null references contacts (id) on delete cascade,
  body text not null,
  author text,
  at timestamptz not null default now()
);
create index notes_contact_idx on notes (contact_id, at);

-- ── drafts ───────────────────────────────────────────────────────────────────
-- SMS replies drafted by /lead-agent (or a human), awaiting approval before send.
-- status: pending | approved | sent | rejected. `sent_by` records which operator
-- approved a send (audit trail — wiki/decisions/0004 security note).
create table drafts (
  id bigint generated always as identity primary key,
  contact_id uuid not null references contacts (id) on delete cascade,
  text text not null,
  status text not null default 'pending',
  sent_text text,
  sent_by sender_kind,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drafts_contact_idx on drafts (contact_id);
create index drafts_pending_idx on drafts (status) where status = 'pending';

-- ── messages ─────────────────────────────────────────────────────────────────
-- Full SMS history per contact, so the conversation screen never has to re-fetch
-- from GHL to render a thread. `ghl_message_id` is unique for webhook idempotency
-- (GHL can redeliver the same event; don't double-insert / double-trigger).
create table messages (
  id bigint generated always as identity primary key,
  contact_id uuid not null references contacts (id) on delete cascade,
  ghl_message_id text unique,               -- null for locally-composed, set for GHL-synced
  direction message_direction not null,
  body text not null default '',
  sender sender_kind,                       -- meaningful for outbound
  at timestamptz not null,
  synced_at timestamptz not null default now()
);
create index messages_contact_idx on messages (contact_id, at);

-- ── updated_at trigger ───────────────────────────────────────────────────────
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_touch before update on contacts
  for each row execute function touch_updated_at();
create trigger drafts_touch before update on drafts
  for each row execute function touch_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Shared workspace: any authenticated user (the 2 operators) can do everything;
-- the anon role gets nothing. service_role bypasses RLS entirely (used only by
-- server-side routes: the webhook handler and the send endpoint).
alter table contacts enable row level security;
alter table stage_history enable row level security;
alter table notes enable row level security;
alter table drafts enable row level security;
alter table messages enable row level security;

create policy "authenticated full access" on contacts
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on stage_history
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on notes
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on drafts
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on messages
  for all to authenticated using (true) with check (true);
