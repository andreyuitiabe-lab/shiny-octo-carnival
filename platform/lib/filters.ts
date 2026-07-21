// Shared filter option lists + matching logic, used by the Kanban, Leads, and
// Conversations filter rows so all three behave identically.
import type { BadgeKind, Lead } from "./types";
import { badgeForBucket } from "./types";
import { waitInfo } from "./wait";
import type { FilterOption } from "@/components/FilterDropdown";

// Each filter is a list of accepted values; an empty list means "no filter"
// (accept all). Multi-select — e.g. pick several classifications at once to pull
// "everything not discarded".
export type Filters = {
  county: string[];
  classification: string[]; // BadgeKind values
  assigned: string[]; // "a" | "b" | "unassigned"
  waiting: string[]; // "you" | "them" | "overdue"
};

export const EMPTY_FILTERS: Filters = {
  county: [],
  classification: [],
  assigned: [],
  waiting: [],
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

// Within one filter, values are OR'd (any match passes); across filters they're
// AND'd (must pass every active filter). An empty list = that filter is inactive.
function matchesWaiting(lead: Lead, accepted: string[]): boolean {
  if (accepted.length === 0) return true;
  const wi = waitInfo(lead);
  return accepted.some((w) => {
    if (w === "you") return wi.owe === "you";
    if (w === "them") return wi.owe === "them";
    if (w === "overdue") return wi.overdue;
    return false;
  });
}

function matchesAssigned(lead: Lead, accepted: string[]): boolean {
  if (accepted.length === 0) return true;
  return accepted.some((a) => (a === "unassigned" ? lead.assignedTo === null : lead.assignedTo === a));
}

/** True if the lead passes ALL active filters (empty list = filter not applied). */
export function matchesFilters(lead: Lead, f: Filters): boolean {
  if (f.county.length && !f.county.includes(lead.county)) return false;
  if (f.classification.length) {
    const kind = classificationValue(lead);
    if (!kind || !f.classification.includes(kind)) return false;
  }
  if (!matchesAssigned(lead, f.assigned)) return false;
  if (!matchesWaiting(lead, f.waiting)) return false;
  return true;
}

export function hasActiveFilters(f: Filters): boolean {
  return f.county.length > 0 || f.classification.length > 0 || f.assigned.length > 0 || f.waiting.length > 0;
}
