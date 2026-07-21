// The 12 canonical funnel stages, in pipeline order — mirrors tools/crm_db.py's
// STAGE_ORDER. Kept separate from lib/types.ts (which only declares the `Stage`
// union) so the ordered list lives in exactly one place for any UI that needs to
// enumerate every stage (e.g. the Conversations thread's stage-selector popover).
import type { Stage } from "./types";

export const ALL_STAGES: Stage[] = [
  "New",
  "Needs Triage",
  "Engaging",
  "Negotiating",
  "Qualifying",
  "Ready for Research",
  "Proposal Ready",
  "Proposal Sent",
  "Under Contract",
  "Closed",
  "Discarded",
  "Do Not Contact",
];
