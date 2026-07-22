import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classify } from "@/lib/triage";
import { openingDecision } from "@/lib/opening-script";
import type { Message, Stage } from "@/lib/types";

// This route talks to Supabase with the service-role key and must never be
// statically optimized or cached — it's a side-effecting POST handler.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GHL / SwiftScale inbound-message webhook.
 *
 * SwiftScale is a white-labeled GoHighLevel. Andre wires this up as a Workflow:
 * trigger "Customer Replied" (inbound message) → action "Webhook" (POST, JSON)
 * to `https://<app>/api/webhooks/ghl`, with a custom payload mapping the GHL
 * fields to the names below. Because a Workflow webhook has no public-key
 * signature (that's a Marketplace-app feature we don't use), we authenticate
 * with a shared secret Andre sets in BOTH places: the `x-webhook-secret` header
 * on the GHL webhook action, and the `GHL_WEBHOOK_SECRET` env var here.
 *
 * Expected JSON payload (map these in the GHL webhook action; several aliases
 * are accepted so the exact field names in GHL's UI don't have to match):
 *   messageId      — GHL message id      (aliases: message_id, id)          [required, idempotency key]
 *   contactId      — GHL contact id      (aliases: contact_id)              [required]
 *   conversationId — GHL conversation id (aliases: conversation_id)
 *   body           — the SMS text        (aliases: message, messageBody, message_body)
 *   direction      — "inbound"|"outbound" (default "inbound")
 *   name           — contact name        (aliases: contactName, full_name, fullName)
 *   phone          — contact phone
 *   timestamp      — ISO/epoch of the message (aliases: dateAdded, date_added)
 *
 * Behaviour: idempotent on messageId; upserts the contact; records the message;
 * for INBOUND, runs deterministic triage (lib/triage.ts) and moves the lead —
 * conservatively. It never auto-advances into negotiation (that's a human job,
 * per wiki ADR 0003); it only routes to the human triage queue, discards clear
 * declines, and hard-forces "Do Not Contact" on an opt-out (a compliance event).
 */

const AUTO_STAGES: Stage[] = ["New", "Needs Triage", "Engaging"];

interface Parsed {
  messageId: string;
  contactId: string;
  conversationId: string | null;
  body: string;
  direction: "inbound" | "outbound";
  name: string | null;
  phone: string | null;
  at: string;
}

function pick(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function parsePayload(raw: unknown): Parsed | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body is not a JSON object" };
  const o = raw as Record<string, unknown>;

  const messageId = pick(o, "messageId", "message_id", "id");
  const contactId = pick(o, "contactId", "contact_id");
  if (!messageId) return { error: "missing messageId" };
  if (!contactId) return { error: "missing contactId" };

  const rawDir = (pick(o, "direction") ?? "inbound").toLowerCase();
  const direction: "inbound" | "outbound" = rawDir === "outbound" ? "outbound" : "inbound";

  const tsRaw = pick(o, "timestamp", "dateAdded", "date_added");
  let at = new Date().toISOString();
  if (tsRaw) {
    const d = new Date(/^\d+$/.test(tsRaw) ? Number(tsRaw) : tsRaw);
    if (!Number.isNaN(d.getTime())) at = d.toISOString();
  }

  return {
    messageId,
    contactId,
    conversationId: pick(o, "conversationId", "conversation_id"),
    body: pick(o, "body", "message", "messageBody", "message_body") ?? "",
    direction,
    name: pick(o, "name", "contactName", "full_name", "fullName"),
    phone: pick(o, "phone"),
    at,
  };
}

// Load a contact's full thread (oldest first) so the opening script can see
// what's already been asked/answered before deciding the next question.
async function fetchThread(
  db: ReturnType<typeof createAdminClient>,
  contactId: string,
): Promise<Message[]> {
  const { data } = await db
    .from("messages")
    .select("id, direction, body, at, sender")
    .eq("contact_id", contactId)
    .order("at", { ascending: true });
  return (data ?? []).map((m) => ({
    id: String(m.id),
    direction: m.direction as Message["direction"],
    body: String(m.body ?? ""),
    at: String(m.at),
    sender: (m.sender as Message["sender"]) ?? undefined,
  }));
}

export async function POST(req: NextRequest) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed: without a configured secret we can't authenticate anyone.
    return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  }
  if (req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const parsed = parsePayload(raw);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const db = createAdminClient();

  // ── Idempotency ──────────────────────────────────────────────────────────
  // GHL can redeliver the same event; ghl_message_id is unique in the schema.
  // If we've already stored this message, acknowledge and do nothing else.
  const { data: existing, error: existErr } = await db
    .from("messages")
    .select("id")
    .eq("ghl_message_id", parsed.messageId)
    .maybeSingle();
  if (existErr) {
    return NextResponse.json({ ok: false, error: existErr.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // ── Upsert the contact ─────────────────────────────────────────────────────
  const { data: found, error: findErr } = await db
    .from("contacts")
    .select("id, our_stage, unread_count, name, phone, ghl_conversation_id")
    .eq("ghl_contact_id", parsed.contactId)
    .maybeSingle();
  if (findErr) {
    return NextResponse.json({ ok: false, error: findErr.message }, { status: 500 });
  }

  let contactRowId: string;
  let currentStage: Stage;
  let unread = 0;

  if (found) {
    contactRowId = found.id as string;
    currentStage = found.our_stage as Stage;
    unread = (found.unread_count as number) ?? 0;
  } else {
    const { data: created, error: createErr } = await db
      .from("contacts")
      .insert({
        ghl_contact_id: parsed.contactId,
        ghl_conversation_id: parsed.conversationId,
        name: parsed.name,
        phone: parsed.phone,
        our_stage: "New",
      })
      .select("id, our_stage")
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { ok: false, error: createErr?.message ?? "contact insert failed" },
        { status: 500 },
      );
    }
    contactRowId = created.id as string;
    currentStage = created.our_stage as Stage;
  }

  // ── Record the message ─────────────────────────────────────────────────────
  const { error: msgErr } = await db.from("messages").insert({
    contact_id: contactRowId,
    ghl_message_id: parsed.messageId,
    direction: parsed.direction,
    body: parsed.body,
    at: parsed.at,
  });
  if (msgErr) {
    // A unique-violation here means a concurrent redelivery beat us to it after
    // our idempotency check — treat as already-processed, not an error.
    if (msgErr.code === "23505") {
      return NextResponse.json({ ok: true, deduped: true });
    }
    return NextResponse.json({ ok: false, error: msgErr.message }, { status: 500 });
  }

  // ── Update the contact's last-message snapshot ─────────────────────────────
  const contactPatch: Record<string, unknown> = {
    last_message_body: parsed.body,
    last_message_direction: parsed.direction,
    last_message_at: parsed.at,
  };
  if (parsed.direction === "inbound") {
    contactPatch.unread_count = unread + 1;
  }
  if (parsed.conversationId && !found?.ghl_conversation_id) {
    contactPatch.ghl_conversation_id = parsed.conversationId;
  }
  if (parsed.name && !found?.name) contactPatch.name = parsed.name;
  if (parsed.phone && !found?.phone) contactPatch.phone = parsed.phone;

  // ── Triage + opening script (inbound only) ─────────────────────────────────
  let triageBucket: string | null = null;
  let nextStage: Stage | null = null;
  let stageReason: string | null = null;
  let openingDraft: { text: string; step: string } | null = null;

  if (parsed.direction === "inbound") {
    const result = classify(parsed.body);
    triageBucket = result.bucket;
    contactPatch.triage_bucket = result.bucket;
    contactPatch.triage_matched = result.matched;
    contactPatch.triage_reason = result.reason;
    contactPatch.triage_source = "rule";
    contactPatch.triage_classified_at = new Date().toISOString();

    if (result.bucket === "do_not_contact") {
      // Compliance opt-out — forced regardless of current stage.
      nextStage = "Do Not Contact";
      stageReason = "opt-out recebido (STOP) — webhook";
    } else if (result.bucket === "cancelled" || result.bucket === "cancelled_wrong_number") {
      // Unambiguous decline — discard, but only if a human isn't working it.
      if (AUTO_STAGES.includes(currentStage)) {
        nextStage = "Discarded";
        stageReason = `triagem automatica: ${result.bucket}`;
      }
    } else if (AUTO_STAGES.includes(currentStage)) {
      // Real engagement, lead still in the opening phase (no human on it yet):
      // run the §1c opening script. SHADOW MODE — it only decides the reply;
      // we save it as a pending draft below and never auto-send.
      const thread = await fetchThread(db, contactRowId);
      const decision = openingDecision(thread, result.bucket);
      if (decision.action === "draft") {
        openingDraft = { text: decision.text, step: decision.step };
        if (currentStage !== "Engaging") {
          nextStage = "Engaging";
          stageReason = `IA abriu conversa (§1c: ${decision.step})`;
        }
      } else {
        nextStage = "Needs Triage";
        stageReason = decision.reason;
      }
    }
    // else: a human already owns this lead (stage past the opening) — just
    // record the message; don't touch the stage.
  }

  if (nextStage) contactPatch.our_stage = nextStage;

  const { error: updErr } = await db.from("contacts").update(contactPatch).eq("id", contactRowId);
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  // ── Stage history, opening draft, and a note (best-effort, non-fatal) ──────
  if (nextStage) {
    await db.from("stage_history").insert({
      contact_id: contactRowId,
      stage: nextStage,
      reason: stageReason,
    });
  }
  if (openingDraft) {
    // SHADOW MODE: the AI's opening reply is stored as a PENDING draft for a
    // human to approve & send — nothing goes to the seller automatically.
    await db.from("drafts").insert({
      contact_id: contactRowId,
      text: openingDraft.text,
      status: "pending",
    });
    await db.from("notes").insert({
      contact_id: contactRowId,
      author: "opening-script",
      body: `IA redigiu abertura (§1c: ${openingDraft.step}) — revisar e enviar.`,
    });
  } else if (triageBucket) {
    await db.from("notes").insert({
      contact_id: contactRowId,
      author: "triage-webhook",
      body: `Triagem determinística: ${triageBucket}${nextStage ? ` → ${nextStage}` : ""}.`,
    });
  }

  return NextResponse.json({
    ok: true,
    contactId: contactRowId,
    bucket: triageBucket,
    stage: nextStage ?? currentStage,
    drafted: openingDraft ? openingDraft.step : null,
  });
}
