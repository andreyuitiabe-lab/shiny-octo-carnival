// Data model — mirrors the real toolkit's tools/crm_db.py, not the platform's own
// invention. SwiftScale/GHL is transport only; stage/triage/notes/drafts live here.
// See wiki/decisions/0001-swiftscale-transport-only.md and
// wiki/reference/conversation-trajectories.md for the "why" behind this shape.

/** The 12 canonical funnel stages (tools/crm_db.py::STAGE_ORDER). UI copy is in
 * English per the design handoff; these map to ~7 configurable macro Kanban lanes
 * via KANBAN_LANES below, not 1:1 columns. */
export type Stage =
  | "New"
  | "Needs Triage"
  | "Engaging"
  | "Negotiating"
  | "Qualifying"
  | "Ready for Research"
  | "Proposal Ready"
  | "Proposal Sent"
  | "Under Contract"
  | "Closed"
  | "Discarded"
  | "Do Not Contact";

/** Deterministic triage buckets from tools/triage_rules.py — classification badges
 * are derived 1:1 from these, never invented ad hoc in the UI layer. */
export type TriageBucket =
  | "hot_lead_candidate" // rumo F/H — price/negotiation signal
  | "needs_ai" // rumo G and anything ambiguous
  | "possible_rumo_j" // extreme/dismissive price — flag, never auto-discard
  | "cancelled" // rumo C/D — hard decline
  | "cancelled_wrong_number" // rumo E
  | "do_not_contact" // rumo B — opt-out/STOP
  | null; // no inbound message classified yet

export type BadgeKind =
  | "price" // hot_lead_candidate
  | "triage" // needs_ai
  | "review" // possible_rumo_j
  | "discarded" // cancelled
  | "wrong" // cancelled_wrong_number
  | "dnc" // do_not_contact
  | null;

export function badgeForBucket(bucket: TriageBucket): BadgeKind {
  switch (bucket) {
    case "hot_lead_candidate":
      return "price";
    case "needs_ai":
      return "triage";
    case "possible_rumo_j":
      return "review";
    case "cancelled":
      return "discarded";
    case "cancelled_wrong_number":
      return "wrong";
    case "do_not_contact":
      return "dnc";
    default:
      return null;
  }
}

export type MessageDirection = "inbound" | "outbound";

/** Who acted, for the outbound message left-border color + the "who's on it"
 * indicator. "automation" = /opening-script; "a"/"b" = the two human operators. */
export type SenderKind = "automation" | "a" | "b";

export interface Message {
  id: string;
  direction: MessageDirection;
  body: string;
  at: string; // ISO timestamp
  sender?: SenderKind; // only meaningful for outbound
}

export interface SystemNote {
  id: string;
  body: string;
  at: string; // ISO timestamp
  author: string; // e.g. "triage-inbox", "opening-script", "seller-dossier"
}

export interface Draft {
  id: string;
  text: string;
  status: "pending" | "approved" | "sent" | "rejected";
  createdAt: string;
  sentText?: string | null;
}

export interface StageHistoryEntry {
  stage: Stage;
  at: string;
  reason?: string | null;
}

export interface DiligenceItem {
  label: string;
  detail: string;
  status: "ok" | "caution" | "risk";
}

export interface Dossier {
  verdict: "PURSUE" | "NEGOTIATE" | "WALK";
  gapOverMao: string; // e.g. "+18%"
  rationale: string;
  opening: number;
  target: number;
  walkAway: number;
  sellerAsk: number;
  fmv: number;
  eyeballScore: number; // 0-100, Satellite Scout
  parcelId: string;
  deedAcres: number;
  zoning: string;
  structures: string;
  diligence: DiligenceItem[];
  nextQuestion: string;
  dealKillers: string[];
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  county: string;
  acreage: string; // display string, "—" when unknown
  stage: Stage;
  stageHistory: StageHistoryEntry[];
  triageBucket: TriageBucket;
  triageMatched?: string | null;
  triageReason?: string | null;
  lastMessageBody: string;
  lastMessageDirection: MessageDirection;
  lastMessageAt: string; // ISO timestamp
  unreadCount: number;
  assignedTo: SenderKind | null;
  tags: string[];
  notes: SystemNote[];
  drafts: Draft[];
  messages: Message[];
  dossier: Dossier | null;
  assessedValue?: number | null;
  estResale?: number | null;
  sourceList?: string;
  firstContactAt?: string;
}

/** ~7 macro Kanban lanes — the funnel has 12 real stages, grouped for the board.
 * This mapping is meant to be configurable later; hardcoded here for v1. */
export const KANBAN_LANES: { key: string; label: string; stages: Stage[]; highlight?: boolean }[] = [
  { key: "triage", label: "New / Triage", stages: ["New", "Needs Triage"] },
  { key: "engaging", label: "Engaging", stages: ["Engaging"] },
  { key: "negotiating", label: "Negotiating", stages: ["Negotiating", "Qualifying"] },
  { key: "research", label: "Ready for Research", stages: ["Ready for Research"], highlight: true },
  { key: "proposal", label: "Proposal", stages: ["Proposal Ready", "Proposal Sent"] },
  { key: "closing", label: "Closing", stages: ["Under Contract", "Closed"] },
  { key: "dnc", label: "Discarded / DNC", stages: ["Discarded", "Do Not Contact"] },
];

export function laneForStage(stage: Stage): string {
  return KANBAN_LANES.find((l) => l.stages.includes(stage))?.key ?? "triage";
}
