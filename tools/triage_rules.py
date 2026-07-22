#!/usr/bin/env python3
"""
Triage Rules — zero-AI deterministic pre-classifier for inbound SMS replies.

Given the last inbound message of a conversation, decides whether it can be
resolved without spending any AI tokens (opt-out, hard decline, wrong number)
or must go to the AI/human attention queue (price signal, ambiguous reply).

Grounded in SELLER-DOSSIER-PLAYBOOK.md §1b "Conversation trajectories" — a
real sample of SwiftScale (GoHighLevel) replies pulled 18 jul 2026. The one
rule that matters most: a price/number signal ALWAYS wins over negative
keywords, because "No lowball offers, don't waste my time" is a counter-offer
mid-negotiation, not a rejection — checking price first prevents an active
negotiation from being auto-closed as Cancelled.

Exception found in the full-history audit (20 jul 2026, rumo J): a price can
also be a polite decline in disguise — "$25,000,000... we will walk away" for
an ordinary lot, or "$2M" escalating to "$3M, it's an animal refuge" once
questioned. These still route to the human queue (never auto-discarded — the
cost of losing a genuine high-value lead outweighs the cost of one manual
review), but get flagged `possible_rumo_j` instead of the normal hot-lead
badge, so a human knows to sanity-check before treating it as serious.

Usage (library):
    from triage_rules import classify
    result = classify("500k")
    # -> {"bucket": "hot_lead_candidate", "matched": "500k", "reason": None}

No network calls, no dependencies beyond the standard library.
"""

import re

# --- bucket names -----------------------------------------------------------
DO_NOT_CONTACT = "do_not_contact"          # rumo B — opt-out/STOP
CANCELLED_WRONG_NUMBER = "cancelled_wrong_number"  # rumo E
CANCELLED = "cancelled"                    # rumo C/D — hard decline (with or without reason)
HOT_LEAD_CANDIDATE = "hot_lead_candidate"  # rumo F/H — price/negotiation signal
POSSIBLE_RUMO_J = "possible_rumo_j"        # rumo J — extreme/dismissive price, flag for human review
NEEDS_AI = "needs_ai"                      # rumo G and anything else ambiguous

# --- patterns ----------------------------------------------------------------
# Price/number signal: currency symbol, "###k"/"###M" shorthand, comma-grouped
# thousands, or a bare 5+ digit number. Deliberately does NOT match bare
# 3-digit numbers ("221 feet", "970 feet deep") so property-detail answers
# don't get mistaken for a price and pulled out of the "needs AI" queue.
#
# The "M"/"m" (million) alternatives are listed before the plain "$digits"
# alternative so that e.g. "$3M" matches as a whole token instead of the
# generic dollar-amount alternative grabbing just "$3" and leaving the "M"
# multiplier behind (Python's re picks the first alternative that matches at
# a given position, not the longest one).
_PRICE_RE = re.compile(
    r"\$\s?\d+(?:\.\d+)?\s?m\b"     # $2M / $2.5M
    r"|\$\s?\d[\d,]*"               # $850,000 / $225k
    r"|\b\d+(?:\.\d+)?\s?m\b"       # 2M / 2.5M (bare, no $)
    r"|\b\d+\s?k\b"                 # 500k / 225 k
    r"|\b\d{1,3}(?:,\d{3})+\b"      # 850,000 (comma-grouped, no $)
    r"|\b\d{5,}\b",                 # bare 5+ digit number
    re.IGNORECASE,
)

# Threshold above which a matched price is treated as "extreme" (rumo J
# candidate) rather than a plausible negotiation number for TN land.
_EXTREME_PRICE_THRESHOLD = 1_000_000

# Explicit dismissal phrases seen alongside an absurd/ironic price in the
# rumo J audit sample — these signal "polite decline", not "counter-offer".
_DISMISSIVE_RE = re.compile(r"\bwalk away\b|\bnever pay\b", re.IGNORECASE)

_STOP_RE = re.compile(r"\bstop\b|\bunsubscribe\b", re.IGNORECASE)

_WRONG_NUMBER_RE = re.compile(r"wrong number", re.IGNORECASE)

# Deliberately does NOT include a bare "no"/"nope"/"no thanks" — those are too
# often an ANSWER ("is it vacant?" -> "No") rather than a rejection, and this
# classifier sees one message with no thread context. Anything ambiguous with a
# "no" falls through to NEEDS_AI (a human/AI reads the full thread). Only
# unambiguous declines auto-discard. (Conservative tuning, Andre 21 jul 2026.)
_REJECT_RE = re.compile(
    r"not interested"
    r"|leave me alone"
    r"|absolutely not"
    r"|do ?n[o']?t contact"
    r"|stop (?:texting|calling|messaging)"
    r"|not selling"
    r"|not for sale"
    r"|go (?:to hell|fuck yourself)"
    r"|fuck (?:you|off)"
    r"|piss off",
    re.IGNORECASE,
)


def _price_value(token):
    """Parse a token matched by _PRICE_RE (e.g. "$25,000,000", "500k", "$3M")
    into a dollar amount (float). Returns None if it can't be parsed.
    """
    if not token:
        return None
    cleaned = token.strip().replace("$", "").replace(",", "").strip()
    multiplier = 1
    if cleaned[-1:].lower() == "m":
        multiplier = 1_000_000
        cleaned = cleaned[:-1].strip()
    elif cleaned[-1:].lower() == "k":
        multiplier = 1_000
        cleaned = cleaned[:-1].strip()
    try:
        return float(cleaned) * multiplier
    except ValueError:
        return None


def classify(last_inbound_text):
    """Classify a single inbound SMS body into a deterministic bucket, or
    NEEDS_AI if none of the zero-cost rules apply.

    Order matters: price signal is checked FIRST and short-circuits every
    other rule, per the playbook's rumo H (negotiation "no" != rejection "no").
    Within that price branch, an extreme value (>= _EXTREME_PRICE_THRESHOLD)
    or an explicit dismissive phrase downgrades HOT_LEAD_CANDIDATE to
    POSSIBLE_RUMO_J — still routed to the human queue, never auto-discarded,
    just flagged for a sanity check before treating it as a serious lead.
    """
    text = (last_inbound_text or "").strip()
    if not text:
        return {"bucket": NEEDS_AI, "matched": None, "reason": None}

    price_match = _PRICE_RE.search(text)
    if price_match:
        token = price_match.group(0)
        value = _price_value(token)
        is_extreme = value is not None and value >= _EXTREME_PRICE_THRESHOLD
        if is_extreme or _DISMISSIVE_RE.search(text):
            return {"bucket": POSSIBLE_RUMO_J, "matched": token, "reason": text}
        return {"bucket": HOT_LEAD_CANDIDATE, "matched": token, "reason": text}

    if _STOP_RE.search(text):
        return {"bucket": DO_NOT_CONTACT, "matched": _STOP_RE.search(text).group(0), "reason": text}

    if _WRONG_NUMBER_RE.search(text):
        return {"bucket": CANCELLED_WRONG_NUMBER, "matched": "wrong number", "reason": text}

    m = _REJECT_RE.search(text)
    if m:
        return {"bucket": CANCELLED, "matched": m.group(0), "reason": text}

    return {"bucket": NEEDS_AI, "matched": None, "reason": text}


if __name__ == "__main__":
    # quick self-test against the real examples from the playbook sample
    samples = [
        ("Stop", DO_NOT_CONTACT),
        ("Please stop texting me. Thank you", DO_NOT_CONTACT),
        ("Nope \U0001F645‍♀️", NEEDS_AI),  # short dismissive w/o keyword -> AI queue
        ("Not interested", CANCELLED),
        # "no thanks" is deliberately NOT auto-discarded (conservative tuning) —
        # it could be an answer, not a rejection, so it goes to the human queue.
        ("No thanks", NEEDS_AI),
        ("No thank you", NEEDS_AI),
        ("No, it's vacant", NEEDS_AI),
        ("Go fuck yourself", CANCELLED),
        ("I think you have the wrong number", CANCELLED_WRONG_NUMBER),
        ("Wrong number sorry", CANCELLED_WRONG_NUMBER),
        ("Absolutely not...septic for my home is on that lot.", CANCELLED),
        ("500k", HOT_LEAD_CANDIDATE),
        ("$850,000 or don't waste my time. Already have an offer at $800,000. Beat it by $50k and it's yours next week.", HOT_LEAD_CANDIDATE),
        ("$999,000", HOT_LEAD_CANDIDATE),  # just under the 1M rumo J threshold
        ("No lowball offers", NEEDS_AI),  # no price digit in THIS message alone -> AI queue, not auto-Cancelled
        ("221 feet", NEEDS_AI),  # bare 3-digit number, not a price -> must NOT be pulled from AI queue
        ("What are you looking for?", NEEDS_AI),
        # rumo J: extreme/dismissive price used as a polite decline, never auto-discarded
        ("Sure!  70 acres, two houses, a 70 cow working dairy farm. $25,000,000.  We will walk away", POSSIBLE_RUMO_J),
        ("It's an animal refuge, $3M", POSSIBLE_RUMO_J),
        ("$1,000,000 for the parcel", POSSIBLE_RUMO_J),  # threshold test: exactly 1M -> flagged
    ]
    ok = True
    for text, expected in samples:
        got = classify(text)["bucket"]
        status = "OK" if got == expected else "FAIL"
        if got != expected:
            ok = False
        print(f"[{status}] {text!r} -> {got} (expected {expected})")
    if not ok:
        raise SystemExit(1)
