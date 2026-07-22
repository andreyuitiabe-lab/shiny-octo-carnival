// Seed the DEV Supabase project with the mock leads (lib/mock-data.ts) so the
// three screens render real content end-to-end before any real seller data
// exists. Run from platform/:  node scripts/seed-dev.mts
//
// SAFETY: hard-refuses to run unless the Supabase URL is the known DEV project.
// It uses the service-role key (bypasses RLS) — never point this at prod.

import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import type { Lead } from "../lib/types.ts";
import { createClient } from "@supabase/supabase-js";

const DEV_REF = "fgcdduyphjbfahrfwvcl"; // dev project only

const here = dirname(fileURLToPath(import.meta.url));

// Node's type-stripping can't resolve mock-data's extensionless `./now` import,
// so materialize a patched copy next to now.ts, import it, then delete it.
const patchedPath = join(here, "..", "lib", "_seed-mockdata.mts");
writeFileSync(
  patchedPath,
  readFileSync(join(here, "..", "lib", "mock-data.ts"), "utf8").replace(
    'from "./now"',
    'from "./now.ts"',
  ),
);
let LEADS: Lead[];
try {
  ({ LEADS } = await import(pathToFileURL(patchedPath).href));
} finally {
  rmSync(patchedPath, { force: true });
}
const env = Object.fromEntries(
  readFileSync(join(here, "..", ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url.includes(DEV_REF)) {
  console.error(`REFUSING: SUPABASE_URL (${url}) is not the dev project ${DEV_REF}.`);
  process.exit(1);
}
if (!serviceKey) {
  console.error("REFUSING: no SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Idempotent: wipe any previous seed rows (children cascade on delete).
  const { error: delErr } = await db.from("contacts").delete().like("ghl_contact_id", "seed-%");
  if (delErr) throw new Error(`wipe: ${delErr.message}`);

  let contacts = 0;
  let messages = 0;

  for (const lead of LEADS) {
    const { data: c, error: cErr } = await db
      .from("contacts")
      .insert({
        ghl_contact_id: `seed-${lead.id}`,
        ghl_conversation_id: `seed-conv-${lead.id}`,
        name: lead.name,
        phone: lead.phone,
        tags: lead.tags,
        our_stage: lead.stage,
        assigned_to: lead.assignedTo,
        unread_count: lead.unreadCount,
        last_message_body: lead.lastMessageBody,
        last_message_direction: lead.lastMessageDirection,
        last_message_at: lead.lastMessageAt,
        triage_bucket: lead.triageBucket,
        triage_matched: lead.triageMatched ?? null,
        triage_reason: lead.triageReason ?? null,
        triage_source: lead.triageBucket ? "rule" : null,
        triage_classified_at: lead.triageBucket ? lead.lastMessageAt : null,
      })
      .select("id")
      .single();
    if (cErr || !c) throw new Error(`contact ${lead.id}: ${cErr?.message}`);
    const cid = c.id as string;
    contacts++;

    if (lead.messages.length) {
      const { error } = await db.from("messages").insert(
        lead.messages.map((m, i) => ({
          contact_id: cid,
          ghl_message_id: `seed-${lead.id}-m${i}`,
          direction: m.direction,
          body: m.body,
          sender: m.sender ?? null,
          at: m.at,
        })),
      );
      if (error) throw new Error(`messages ${lead.id}: ${error.message}`);
      messages += lead.messages.length;
    }

    if (lead.notes.length) {
      const { error } = await db.from("notes").insert(
        lead.notes.map((n) => ({ contact_id: cid, body: n.body, author: n.author, at: n.at })),
      );
      if (error) throw new Error(`notes ${lead.id}: ${error.message}`);
    }

    if (lead.drafts.length) {
      const { error } = await db.from("drafts").insert(
        lead.drafts.map((d) => ({
          contact_id: cid,
          text: d.text,
          status: d.status,
          sent_text: d.sentText ?? null,
          created_at: d.createdAt,
        })),
      );
      if (error) throw new Error(`drafts ${lead.id}: ${error.message}`);
    }

    if (lead.stageHistory.length) {
      const { error } = await db.from("stage_history").insert(
        lead.stageHistory.map((h) => ({
          contact_id: cid,
          stage: h.stage,
          reason: h.reason ?? null,
          at: h.at,
        })),
      );
      if (error) throw new Error(`stage_history ${lead.id}: ${error.message}`);
    }
  }

  console.log(`Seeded ${contacts} contacts, ${messages} messages into DEV (${DEV_REF}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
