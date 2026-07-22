/**
 * Triage Rules — zero-AI deterministic pre-classifier for inbound SMS replies.
 *
 * TypeScript port of `tools/triage_rules.py` (kept byte-for-byte equivalent in
 * behaviour — same rule order, same regexes, same self-test cases). Used by the
 * GHL webhook handler (`app/api/webhooks/ghl`) to classify each inbound reply
 * before deciding whether it needs the AI/human queue. If you change one file,
 * change the other and re-run both self-tests.
 *
 * Grounded in SELLER-DOSSIER-PLAYBOOK.md §1b "Conversation trajectories". The
 * one rule that matters most: a price/number signal ALWAYS wins over negative
 * keywords, because "No lowball offers, don't waste my time" is a counter-offer
 * mid-negotiation, not a rejection — checking price first prevents an active
 * negotiation from being auto-closed as Cancelled.
 *
 * Exception (rumo J, from the full-history audit): a price can also be a polite
 * decline in disguise — "$25,000,000... we will walk away" for an ordinary lot,
 * or "$3M, it's an animal refuge". These still route to the human queue (never
 * auto-discarded — losing a genuine high-value lead costs more than one manual
 * review), but get flagged `possible_rumo_j` instead of the normal hot-lead
 * badge, so a human sanity-checks before treating it as serious.
 */

export type TriageBucket =
  | "do_not_contact" // rumo B — opt-out/STOP
  | "cancelled_wrong_number" // rumo E
  | "cancelled" // rumo C/D — hard decline (with or without reason)
  | "hot_lead_candidate" // rumo F/H — price/negotiation signal
  | "possible_rumo_j" // rumo J — extreme/dismissive price, flag for human review
  | "needs_ai"; // rumo G and anything else ambiguous

export interface TriageResult {
  bucket: TriageBucket;
  matched: string | null;
  reason: string | null;
}

// Price/number signal: currency symbol, "###k"/"###M" shorthand, comma-grouped
// thousands, or a bare 5+ digit number. Deliberately does NOT match bare
// 3-digit numbers ("221 feet", "970 feet deep") so property-detail answers
// don't get mistaken for a price and pulled out of the "needs AI" queue.
//
// The "M"/"m" (million) alternatives are listed before the plain "$digits"
// alternative so that e.g. "$3M" matches as a whole token instead of the
// generic dollar-amount alternative grabbing just "$3". JS regex, like Python's
// re, picks the first alternative that matches at a given position, not the
// longest one. Global flag so we can .exec from index 0 (equivalent to search).
const PRICE_RE =
  /\$\s?\d+(?:\.\d+)?\s?m\b|\$\s?\d[\d,]*|\b\d+(?:\.\d+)?\s?m\b|\b\d+\s?k\b|\b\d{1,3}(?:,\d{3})+\b|\b\d{5,}\b/i;

// Threshold above which a matched price is treated as "extreme" (rumo J
// candidate) rather than a plausible negotiation number for TN land.
const EXTREME_PRICE_THRESHOLD = 1_000_000;

// Explicit dismissal phrases seen alongside an absurd/ironic price in the
// rumo J audit sample — these signal "polite decline", not "counter-offer".
const DISMISSIVE_RE = /\bwalk away\b|\bnever pay\b/i;

const STOP_RE = /\bstop\b|\bunsubscribe\b/i;

const WRONG_NUMBER_RE = /wrong number/i;

const REJECT_RE =
  /not interested|no thanks?\b|leave me alone|absolutely not|do ?n[o']?t contact|stop (?:texting|calling|messaging)|not selling|not for sale|go (?:to hell|fuck yourself)|fuck (?:you|off)|piss off/i;

/**
 * Parse a token matched by PRICE_RE (e.g. "$25,000,000", "500k", "$3M") into a
 * dollar amount. Returns null if it can't be parsed.
 */
function priceValue(token: string | null): number | null {
  if (!token) return null;
  let cleaned = token.trim().replace(/\$/g, "").replace(/,/g, "").trim();
  let multiplier = 1;
  const last = cleaned.slice(-1).toLowerCase();
  if (last === "m") {
    multiplier = 1_000_000;
    cleaned = cleaned.slice(0, -1).trim();
  } else if (last === "k") {
    multiplier = 1_000;
    cleaned = cleaned.slice(0, -1).trim();
  }
  const n = Number.parseFloat(cleaned);
  return Number.isNaN(n) ? null : n * multiplier;
}

/**
 * Classify a single inbound SMS body into a deterministic bucket, or NEEDS_AI
 * if none of the zero-cost rules apply.
 *
 * Order matters: price signal is checked FIRST and short-circuits every other
 * rule, per the playbook's rumo H (negotiation "no" != rejection "no"). Within
 * that price branch, an extreme value (>= EXTREME_PRICE_THRESHOLD) or an
 * explicit dismissive phrase downgrades hot_lead_candidate to possible_rumo_j —
 * still routed to the human queue, never auto-discarded, just flagged.
 */
export function classify(lastInboundText: string | null | undefined): TriageResult {
  const text = (lastInboundText ?? "").trim();
  if (!text) {
    return { bucket: "needs_ai", matched: null, reason: null };
  }

  const priceMatch = PRICE_RE.exec(text);
  if (priceMatch) {
    const token = priceMatch[0];
    const value = priceValue(token);
    const isExtreme = value !== null && value >= EXTREME_PRICE_THRESHOLD;
    if (isExtreme || DISMISSIVE_RE.test(text)) {
      return { bucket: "possible_rumo_j", matched: token, reason: text };
    }
    return { bucket: "hot_lead_candidate", matched: token, reason: text };
  }

  const stopMatch = STOP_RE.exec(text);
  if (stopMatch) {
    return { bucket: "do_not_contact", matched: stopMatch[0], reason: text };
  }

  if (WRONG_NUMBER_RE.test(text)) {
    return { bucket: "cancelled_wrong_number", matched: "wrong number", reason: text };
  }

  const rejectMatch = REJECT_RE.exec(text);
  if (rejectMatch) {
    return { bucket: "cancelled", matched: rejectMatch[0], reason: text };
  }

  return { bucket: "needs_ai", matched: null, reason: text };
}
