// "Who is waiting on whom" — derived purely from the direction of the last message.
// See design_handoff_parcel_crm/README.md, "Follow-up / wait indicator (explicit requirement)".
import type { Lead } from "./types";

export type WaitInfo = {
  owe: "you" | "them";
  label: string;
  color: string;
  dot: string;
  overdue: boolean;
};

const FOLLOW_UP_SLA_MS = 2.5 * 24 * 60 * 60 * 1000; // ~2.5 days, per design's "in days" note

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.round(hr / 24);
  return `${days}d`;
}

/** Same as timeAgo() but appends "ago" — used anywhere the raw duration needs
 * to read as a sentence fragment ("2h ago" / "just now"). */
export function agoLabel(iso: string): string {
  const t = timeAgo(iso);
  return t === "just now" ? t : `${t} ago`;
}

export function waitInfo(lead: Lead): WaitInfo {
  const owe: "you" | "them" = lead.lastMessageDirection === "inbound" ? "you" : "them";
  const ageMs = Date.now() - new Date(lead.lastMessageAt).getTime();
  const label = timeAgo(lead.lastMessageAt);

  if (owe === "you") {
    return { owe, label: `Awaiting your reply · ${label}`, color: "var(--brand-bright)", dot: "var(--brand)", overdue: false };
  }
  const overdue = ageMs > FOLLOW_UP_SLA_MS;
  if (overdue) {
    return { owe, label: `Follow-up due · ${label}`, color: "var(--sem-amber-lt)", dot: "var(--sem-amber)", overdue: true };
  }
  return { owe, label: `Waiting on seller · ${label}`, color: "var(--text-dim)", dot: "#5f6b73", overdue: false };
}
