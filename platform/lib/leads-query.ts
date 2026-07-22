// Server-side data access: reads the CRM tables from Supabase and maps them to
// the `Lead` shape the UI already speaks (lib/types.ts). Uses the RLS-scoped
// server client (anon key + the logged-in operator's session), NOT the service
// role — reads should always run as the authenticated user, not as the system.
//
// Fields the schema doesn't store yet (dossier, acreage, assessed value) come
// back null/"—"; the UI already handles those. County is derived from the GHL
// campaign tag ("<county> county, tn (dd mm yyyy)").

import { createClient } from "@/lib/supabase/server";
import type {
  Draft,
  Lead,
  Message,
  Stage,
  StageHistoryEntry,
  SystemNote,
  TriageBucket,
} from "@/lib/types";

// "maury county, tn (18 07 2026)" -> "Maury". "—" when no county tag is present.
function countyFromTags(tags: unknown): string {
  if (!Array.isArray(tags)) return "—";
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const m = /^\s*(.+?)\s+county\b/i.exec(t);
    if (m) {
      return m[1]
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
  }
  return "—";
}

interface ContactRow {
  id: string;
  name: string | null;
  phone: string | null;
  tags: unknown;
  our_stage: Stage;
  assigned_to: "automation" | "a" | "b" | null;
  unread_count: number | null;
  last_message_body: string | null;
  last_message_direction: "inbound" | "outbound" | null;
  last_message_at: string | null;
  triage_bucket: string | null;
  triage_matched: string | null;
  triage_reason: string | null;
  created_at: string;
}

// Group an array of rows by their contact_id into a Map, preserving order.
function groupBy<T extends { contact_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const arr = map.get(r.contact_id);
    if (arr) arr.push(r);
    else map.set(r.contact_id, [r]);
  }
  return map;
}

/**
 * Load every lead with its full thread, notes, drafts and stage history, mapped
 * to the `Lead` shape. Bulk-fetches each child table once and groups in memory
 * (fine at 2-operator volume) rather than issuing a query per contact.
 */
export async function fetchLeads(): Promise<Lead[]> {
  const db = await createClient();

  const { data: contacts, error } = await db
    .from("contacts")
    .select(
      "id, name, phone, tags, our_stage, assigned_to, unread_count, last_message_body, last_message_direction, last_message_at, triage_bucket, triage_matched, triage_reason, created_at",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`fetchLeads/contacts: ${error.message}`);
  if (!contacts || contacts.length === 0) return [];

  const ids = (contacts as ContactRow[]).map((c) => c.id);

  const [msgRes, noteRes, draftRes, histRes] = await Promise.all([
    db
      .from("messages")
      .select("id, contact_id, direction, body, at, sender")
      .in("contact_id", ids)
      .order("at", { ascending: true }),
    db
      .from("notes")
      .select("id, contact_id, body, author, at")
      .in("contact_id", ids)
      .order("at", { ascending: true }),
    db
      .from("drafts")
      .select("id, contact_id, text, status, sent_text, created_at")
      .in("contact_id", ids)
      .order("created_at", { ascending: true }),
    db
      .from("stage_history")
      .select("contact_id, stage, reason, at")
      .in("contact_id", ids)
      .order("at", { ascending: true }),
  ]);

  if (msgRes.error) throw new Error(`fetchLeads/messages: ${msgRes.error.message}`);
  if (noteRes.error) throw new Error(`fetchLeads/notes: ${noteRes.error.message}`);
  if (draftRes.error) throw new Error(`fetchLeads/drafts: ${draftRes.error.message}`);
  if (histRes.error) throw new Error(`fetchLeads/stage_history: ${histRes.error.message}`);

  const msgs = groupBy((msgRes.data ?? []) as Array<{ contact_id: string } & Record<string, unknown>>);
  const notesByC = groupBy((noteRes.data ?? []) as Array<{ contact_id: string } & Record<string, unknown>>);
  const draftsByC = groupBy((draftRes.data ?? []) as Array<{ contact_id: string } & Record<string, unknown>>);
  const histByC = groupBy((histRes.data ?? []) as Array<{ contact_id: string } & Record<string, unknown>>);

  return (contacts as ContactRow[]).map((c) => {
    const messages: Message[] = (msgs.get(c.id) ?? []).map((m) => ({
      id: String(m.id),
      direction: m.direction as Message["direction"],
      body: String(m.body ?? ""),
      at: String(m.at),
      sender: (m.sender as Message["sender"]) ?? undefined,
    }));

    const notes: SystemNote[] = (notesByC.get(c.id) ?? []).map((n) => ({
      id: String(n.id),
      body: String(n.body ?? ""),
      at: String(n.at),
      author: String(n.author ?? ""),
    }));

    const drafts: Draft[] = (draftsByC.get(c.id) ?? []).map((d) => ({
      id: String(d.id),
      text: String(d.text ?? ""),
      status: d.status as Draft["status"],
      createdAt: String(d.created_at),
      sentText: (d.sent_text as string | null) ?? null,
    }));

    const stageHistory: StageHistoryEntry[] = (histByC.get(c.id) ?? []).map((h) => ({
      stage: h.stage as Stage,
      at: String(h.at),
      reason: (h.reason as string | null) ?? null,
    }));

    return {
      id: c.id,
      name: c.name ?? "(sem nome)",
      phone: c.phone ?? "",
      county: countyFromTags(c.tags),
      acreage: "—",
      stage: c.our_stage,
      stageHistory,
      triageBucket: (c.triage_bucket as TriageBucket) ?? null,
      triageMatched: c.triage_matched,
      triageReason: c.triage_reason,
      lastMessageBody: c.last_message_body ?? "",
      lastMessageDirection: c.last_message_direction ?? "inbound",
      lastMessageAt: c.last_message_at ?? c.created_at,
      unreadCount: c.unread_count ?? 0,
      assignedTo: c.assigned_to,
      tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
      notes,
      drafts,
      messages,
      dossier: null,
    } satisfies Lead;
  });
}
