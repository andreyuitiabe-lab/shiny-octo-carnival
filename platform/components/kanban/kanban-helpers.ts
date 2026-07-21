// Shared helpers for the Kanban board — badge→color mapping and the legend data,
// kept out of the components so KanbanCard/KanbanBoard don't duplicate the switch.
import type { BadgeKind } from "@/lib/types";

/** Card left-border / accent color for a classification badge. Falls back to
 * `var(--line)` when the lead has no classification yet (badgeForBucket returned null). */
export function colorForBadge(kind: BadgeKind): string {
  switch (kind) {
    case "price":
      return "var(--sem-green)";
    case "triage":
      return "var(--sem-blue)";
    case "review":
      return "var(--sem-amber)";
    case "discarded":
    case "wrong":
    case "dnc":
      return "var(--sem-gray)";
    default:
      return "var(--line)";
  }
}

export const LEGEND = [
  { color: "var(--sem-green)", label: "Price signal" },
  { color: "var(--sem-blue)", label: "Needs triage" },
  { color: "var(--sem-amber)", label: "Review first" },
  { color: "var(--sem-gray)", label: "Discarded / DNC" },
] as const;
