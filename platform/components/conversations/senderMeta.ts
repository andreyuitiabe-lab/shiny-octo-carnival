// Shared sender presentation — label text + colors used by both the conversation
// list preview line and the thread's outbound message meta / right-border accent.
// Deliberately NOT derived from Badge/BadgeKind — sender identity and triage
// classification are different axes and must never be conflated.
import type { SenderKind } from "@/lib/types";

export const SENDER_LABEL: Record<SenderKind, string> = {
  automation: "Automation",
  a: "Person A",
  b: "Person B",
};

// Text color for the sender label (list preview + outbound message meta row).
export const SENDER_LABEL_COLOR: Record<SenderKind, string> = {
  automation: "var(--sem-gray-lt)",
  a: "var(--sem-blue-lt)",
  b: "var(--sem-amber-lt)",
};

// 3px right-border accent on outbound bubbles — per design handoff, Person B
// intentionally uses brand red here (it's a "who acted" accent, not a
// classification badge), Person A blue, Automation dim gray.
export const SENDER_EDGE_COLOR: Record<SenderKind, string> = {
  automation: "var(--text-dim)",
  a: "var(--sem-blue)",
  b: "var(--brand)",
};
