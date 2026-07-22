// Import the real synced conversations (tools/output/crm_db.json) into Supabase,
// so the platform shows the actual inbox instead of empty screens.
//
// Target project is chosen by env vars so the same script serves dev and prod:
//   dev  (default):  node scripts/import-crm.mts
//   prod:            IMPORT_SUPABASE_URL=... IMPORT_SUPABASE_KEY=... node scripts/import-crm.mts
//
// This is a fast "pass 1": one message per contact (their latest), plus stage,
// triage, notes and stage history. Full thread history is a separate backfill.
// Idempotent: upserts on ghl_contact_id / ghl_message_id, safe to re-run.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));

function envFile(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(join(here, "..", ".env.local"), "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const env = envFile();
const url = process.env.IMPORT_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.IMPORT_SUPABASE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.error("Missing Supabase URL/key.");
  process.exit(1);
}
const ref = url.replace("https://", "").split(".")[0];
console.log(`Target project: ${ref}`);

// Our PT funnel (tools/crm_db.py) → the schema's English enum (lib/types.ts).
const STAGE_MAP: Record<string, string> = {
  Novo: "New",
  "Precisa triagem": "Needs Triage",
  Morno: "Engaging",
  Quente: "Negotiating",
  "Em qualificacao": "Qualifying",
  "Proposta pronta": "Proposal Ready",
  "Proposta enviada": "Proposal Sent",
  Negociando: "Negotiating",
  "Sob contrato": "Under Contract",
  Fechado: "Closed",
  Descartado: "Discarded",
  "Nao incomodar": "Do Not Contact",
};
const mapStage = (s: string | undefined) => STAGE_MAP[s ?? ""] ?? "New";

const iso = (v: unknown): string => {
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof v === "string" && v) return new Date(v).toISOString();
  return new Date().toISOString();
};

interface RawContact {
  contact_id: string;
  conversation_id?: string;
  name?: string;
  phone?: string;
  tags?: string[];
  our_stage?: string;
  last_message_body?: string;
  last_message_direction?: "inbound" | "outbound";
  last_message_at?: number | string;
  unread_count?: number;
  triage?: { bucket?: string | null; matched?: string | null; reason?: string | null; source?: string | null; classified_at?: string | null };
  notes?: { body?: string; author?: string; at?: string }[];
  stage_history?: { stage?: string; at?: string; reason?: string }[];
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const raw = JSON.parse(
  readFileSync(join(here, "..", "..", "tools", "output", "crm_db.json"), "utf8"),
);
const list: RawContact[] = Array.isArray(raw) ? raw : Object.values(raw.contacts ?? raw);

async function main() {
  let ok = 0;
  for (const c of list) {
    const stage = mapStage(c.our_stage);
    const { data: up, error: upErr } = await db
      .from("contacts")
      .upsert(
        {
          ghl_contact_id: c.contact_id,
          ghl_conversation_id: c.conversation_id ?? null,
          name: c.name ?? null,
          phone: c.phone ?? null,
          tags: c.tags ?? [],
          our_stage: stage,
          unread_count: c.unread_count ?? 0,
          last_message_body: c.last_message_body ?? null,
          last_message_direction: c.last_message_direction ?? null,
          last_message_at: c.last_message_at ? iso(c.last_message_at) : null,
          triage_bucket: c.triage?.bucket ?? null,
          triage_matched: c.triage?.matched ?? null,
          triage_reason: c.triage?.reason ?? null,
          triage_source: c.triage?.source ?? null,
          triage_classified_at: c.triage?.classified_at ? iso(c.triage.classified_at) : null,
        },
        { onConflict: "ghl_contact_id" },
      )
      .select("id")
      .single();
    if (upErr || !up) {
      console.error(`contact ${c.contact_id} (${c.name}): ${upErr?.message}`);
      continue;
    }
    const cid = up.id as string;

    if (c.last_message_body) {
      await db.from("messages").upsert(
        {
          contact_id: cid,
          ghl_message_id: `import-${c.contact_id}`,
          direction: c.last_message_direction ?? "inbound",
          body: c.last_message_body,
          at: c.last_message_at ? iso(c.last_message_at) : iso(undefined),
        },
        { onConflict: "ghl_message_id" },
      );
    }

    if (c.stage_history?.length) {
      // Replace to stay idempotent (stage_history has no natural unique key here).
      await db.from("stage_history").delete().eq("contact_id", cid);
      await db.from("stage_history").insert(
        c.stage_history.map((h) => ({
          contact_id: cid,
          stage: mapStage(h.stage),
          reason: h.reason ?? null,
          at: iso(h.at),
        })),
      );
    }

    if (c.notes?.length) {
      await db.from("notes").delete().eq("contact_id", cid);
      await db.from("notes").insert(
        c.notes.map((n) => ({
          contact_id: cid,
          body: n.body ?? "",
          author: n.author ?? null,
          at: iso(n.at),
        })),
      );
    }
    ok++;
  }
  console.log(`Imported ${ok}/${list.length} contacts into ${ref}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
