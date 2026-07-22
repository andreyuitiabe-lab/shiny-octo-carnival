// Opening script (§1c of SELLER-DOSSIER-PLAYBOOK.md) — the ONLY thing the AI is
// allowed to do on its own: open the conversation and gather basic property
// facts. It never discusses price, timeline-to-close, or counters. The moment
// any of that shows up, it stops and routes to the human queue.
//
// SHADOW MODE (as wired into the webhook today): this only decides WHAT the
// opening reply should be. The webhook saves it as a pending DRAFT for a human
// to approve — nothing is auto-sent yet. When Andre trusts the drafts, the same
// decision flips to auto-send.
//
// v1 is deterministic (no LLM) and covers the safe subset of §1c: answer a
// "who is this?" legitimacy question, ask structure + motivation (the proven
// opener), then stop. §1c steps that need parcel data or judgment (confirm-lot
// when ambiguous, "I see you have N lots") are deliberately left to the human
// for now — noted in the reason so we can add parcel-awareness later.
//
// Voice: playbook §6b register 1 — short, plain, no corporate filler, persona
// "Felipe". Questions in English (TN sellers).

import type { Message, TriageBucket } from "./types";

export type OpeningDecision =
  | { action: "draft"; text: string; step: string }
  | { action: "human"; reason: string };

function anyMatch(msgs: Message[], re: RegExp): boolean {
  return msgs.some((m) => re.test(m.body));
}

const WHO_ARE_YOU = /who('?s| is) this|who are you|what do you want|are you an agent|is this a scam/i;
const IDENTITY_ANSWERED = /not an agent|business partners|buy land directly|i buy land/i;
const ASKED_STRUCTURE = /vacant|house on (it|the lot)|structure|is it vacant/i;
const ASKED_MOTIVATION = /thinking about selling|what'?s got you|why (are|you)|looking to sell/i;

/**
 * Decide the next opening move for a conversation whose latest inbound reply is
 * real engagement (NOT an opt-out/decline/wrong-number — the webhook resolves
 * those before calling this). A price/negotiation signal stops the script.
 */
export function openingDecision(thread: Message[], bucket: TriageBucket): OpeningDecision {
  // A price/negotiation signal ends the opening script — §1c: "Do not ask about
  // price, make any counter... goes to the human queue." NOTE: we rely on the
  // classifier's price-first rule to have already flagged these buckets; this
  // function does not independently re-scan the body. That's safe in shadow mode
  // (worst case is a harmless structure/motivation draft a human reviews) — but
  // if this ever drives auto-send, add an independent price check here first.
  if (bucket === "hot_lead_candidate") {
    return { action: "human", reason: "sinal de preço/negociação — §1c manda parar e passar pra você" };
  }
  if (bucket === "possible_rumo_j") {
    return { action: "human", reason: "preço extremo/dispensa (rumo J) — revisar antes de tratar como quente" };
  }

  const outbound = thread.filter((m) => m.direction === "outbound");
  const lastInbound = [...thread].reverse().find((m) => m.direction === "inbound");

  const askedStructure = anyMatch(outbound, ASKED_STRUCTURE);
  const askedMotivation = anyMatch(outbound, ASKED_MOTIVATION);
  const identityAnswered = anyMatch(outbound, IDENTITY_ANSWERED);
  const sellerAskedWhoWeAre = lastInbound ? WHO_ARE_YOU.test(lastInbound.body) : false;

  // 1. Legitimacy question (rumo K) and we haven't established who we are →
  //    answer it and fold the opener questions in.
  if (sellerAskedWhoWeAre && !identityAnswered) {
    return {
      action: "draft",
      step: "identidade + abertura",
      text: "This is Felipe — myself and some business partners buy land directly, not agents. Is there a house on the lot or is it vacant? And what's got you thinking about selling?",
    };
  }

  // 2. Haven't opened the discovery yet → the proven combined opener
  //    (structure + motivation in one message, §1c steps 2+4).
  if (!askedStructure && !askedMotivation) {
    return {
      action: "draft",
      step: "estrutura + motivação",
      text: "Got it. Is there a house on the lot or is it vacant? And what's got you thinking about selling?",
    };
  }

  // 3. Asked about structure, still don't know motivation → ask it plainly.
  if (askedStructure && !askedMotivation) {
    return {
      action: "draft",
      step: "motivação",
      text: "Thanks. What's got you thinking about selling?",
    };
  }

  // 4. Opening basics covered (structure + motivation asked). §1c: STOP — hand
  //    to the human. Anything from here (a price, a question) is theirs.
  return {
    action: "human",
    reason: "abertura coberta (estrutura + motivação) — próximo passo é seu",
  };
}
