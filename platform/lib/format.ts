// Shared display-formatting helpers for the Leads screens — kept here so
// LeadsTable / DetailDrawer / page.tsx don't each reinvent money/sender/date logic.
import type { Lead, SenderKind } from "./types";

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const SENDER_LABEL: Record<SenderKind, string> = {
  automation: "Automation",
  a: "Person A",
  b: "Person B",
};

/** Who sent the most recent message — "Seller" for inbound, otherwise the operator/automation
 * that sent the last outbound message. */
export function lastSenderLabel(lead: Lead): string {
  if (lead.lastMessageDirection === "inbound") return "Seller";
  const lastOutbound = [...lead.messages].reverse().find((m) => m.direction === "outbound");
  if (lastOutbound?.sender) return SENDER_LABEL[lastOutbound.sender];
  return "—";
}

export function assignedToLabel(lead: Lead): string {
  if (!lead.assignedTo) return "—";
  return SENDER_LABEL[lead.assignedTo];
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  // timeZone pinned to UTC so prerendered (server, UTC) and hydrated (browser,
  // local) output match — otherwise a near-midnight date flips a day on hydration.
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
