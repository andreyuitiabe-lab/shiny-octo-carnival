// Shared filter option lists + matching logic, used by the Kanban, Leads, and
// Conversations filter rows so all three behave identically.
import type { BadgeKind, Lead } from "./types";
import { badgeForBucket } from "./types";
import { waitInfo } from "./wait";
import type { FilterOption } from "@/components/FilterDropdown";

export type Filters = {
  county: string | null;
  classification: string | null; // a BadgeKind value, or null
  assigned: string | null; // "a" | "b" | "unassigned" | null
  waiting: string | null; // "you" | "them" | "overdue" | null
};

export const EMPTY_FILTERS: Filters = {
  county: null,
  classification: null,
  assigned: null,
  waiting: null,
};

/** Distinct counties present in the data, alphabetized. */
export function countyOptions(leads: Lead[]): FilterOption[] {
  const set = new Set(leads.map((l) => l.county).filter(Boolean));
  return [...set].sort().map((c) => ({ value: c, label: c }));
}

// Classification options mirror the Badge labels + the semantic swatch colors
// (never brand red — same rule as the badges themselves).
export const CLASSIFICATION_OPTIONS: FilterOption[] = [
  { value: "price", label: "Price signal", swatch: "var(--sem-green)" },
  { value: "triage", label: "Needs triage", swatch: "var(--sem-blue)" },
  { value: "review", label: "Review first", swatch: "var(--sem-amber)" },
  { value: "discarded", label: "Auto-discarded", swatch: "var(--sem-gray)" },
  { value: "wrong", label: "Wrong number", swatch: "var(--sem-gray)" },
  { value: "dnc", label: "Do not contact", swatch: "var(--sem-gray)" },
];

export const ASSIGNED_OPTIONS: FilterOption[] = [
  { value: "a", label: "Person A" },
  { value: "b", label: "Person B" },
  { value: "unassigned", label: "Unassigned" },
];

export const WAITING_OPTIONS: FilterOption[] = [
  { value: "you", label: "Awaiting your reply" },
  { value: "them", label: "Waiting on seller" },
  { value: "overdue", label: "Follow-up due" },
];

function classificationValue(lead: Lead): BadgeKind {
  return badgeForBucket(lead.triageBucket);
}

/** True if the lead passes ALL active filters (null = filter not applied). */
export function matchesFilters(lead: Lead, f: Filters): boolean {
  if (f.county && lead.county !== f.county) return false;
  if (f.classification && classificationValue(lead) !== f.classification) return false;
  if (f.assigned) {
    if (f.assigned === "unassigned" ? lead.assignedTo !== null : lead.assignedTo !== f.assigned) {
      return false;
    }
  }
  if (f.waiting) {
    const wi = waitInfo(lead);
    if (f.waiting === "you" && wi.owe !== "you") return false;
    if (f.waiting === "them" && wi.owe !== "them") return false;
    if (f.waiting === "overdue" && !wi.overdue) return false;
  }
  return true;
}

export function hasActiveFilters(f: Filters): boolean {
  return f.county !== null || f.classification !== null || f.assigned !== null || f.waiting !== null;
}
