# Land Flipping — Project Log & Documentation

> Complete record of what we've built, the data behind it, what we've learned,
> and where it goes next. Last updated: **2026-06-17**.
> Companion docs: [README.md](README.md) (hub), [deep research.md](deep%20research.md)
> (external platform blueprint), [study/](study/) (operator knowledge).

---

## 1. Goals & approach

Two parallel tracks for starting a **land wholesaling / flipping** business:
- **Operator track** — study material to learn how to evaluate, price, and vet deals.
- **Builder track** — tools that encode that knowledge and automate opportunity-finding.

**Constraints we're building under** (decided with the user):
- User is a **non-coder** → all code is handled for them, explained plainly.
- Tools are **single-file, double-click-to-run** (no Node, no servers, no installs).
  Web apps = self-contained HTML; automation = Python that ships with macOS.
- **Start free, validate the model, then pay for data** — only upgrade to paid
  APIs (Regrid/ATTOM) once free sources prove the concept.
- Automation runs **on-demand** on the user's Mac (not an always-on service yet).

---

## 2. What we built

```
Land Flipping/
├── README.md                        ← project hub + how-to
├── PROJECT-LOG.md                   ← this document
├── METHODOLOGY.md                   ← the logic & math behind every engine
├── deep research.md                 ← external blueprint (Market Liquidity Index platform)
├── app/
│   └── deal-analyzer.html           ← analyze ONE parcel (decay valuation + blind offer + diligence)
├── tools/
│   ├── Run County Scanner.command   ← double-click launcher (macOS)
│   ├── county_scanner.py            ← rank ALL US counties (Redfin + Census) — Engine 1 (MLI)
│   ├── Run Parcel Scout.command     ← double-click launcher (macOS)
│   ├── parcel_scout.py              ← pull + score + auto-diligence a county's vacant parcels — Engine 3
│   ├── backtest.py                  ← calibration: does the MLI predict forward liquidity?
│   ├── data/                        ← cached downloads (gitignore-able, large)
│   └── output/                      ← generated reports + CSV
└── study/
    ├── 01-operator-playbook.md      ← the business model, 12-stage pipeline
    └── 02-due-diligence-checklist.md← the gates every parcel must pass
```

### 2.1 Deal Analyzer (`app/deal-analyzer.html`)
Single-file browser app. For **one parcel** it:
- Estimates **market value** via the **acreage decay curve** (research Module 2):
  fits `PPA = a·acres^b` from your comps (log-log least squares) and re-prices
  every comp to the subject's acreage before averaging — so mixed-size comps
  don't skew value. Falls back to b = −0.35 when comps lack size spread.
- Generates a **blind offer** (the opening offer you mail) via the **dynamic
  discount matrix**: base 32% + modifiers for acreage tier, market velocity
  (DOM), and tax-delinquency distress, clamped to **25–40%**, with a $/acre floor.
- Computes **Maximum Allowable Offer (MAO = your ceiling)** backward from
  resale − costs − profit. Recommended opening = lower of blind offer & MAO;
  flags CAUTION when the blind offer already exceeds the MAO (thin margin).
- Runs **diligence gates**; "killer" gates (landlocked, wetland, flood, zoning,
  buildability) force a **KILL**; unknowns hold at **CAUTION**.
- Verdict: **GO / CAUTION / KILL**. Saves deals to browser localStorage.

### 2.2 County Opportunity Scanner (`tools/county_scanner.py`)
Ranks **~2,000 US counties** for land-hunting attractiveness. Top-down "where to
play" engine. Merges three free sources (see §3), scores each county (see §4),
outputs an interactive sortable HTML report + CSV. Run via the `.command` file.

### 2.3 Calibration Backtest (`tools/backtest.py`)
Walk-forward test of whether the score predicts real outcomes (see §5).

### 2.3b County Scores Report (`tools/county_report.py`)
Reads the scanner CSV and writes a readable analytical report
(`output/county-scores-report.html`): a curated **best starter markets**
shortlist (liquid + affordable ≤$400k + ≥30 sales/mo), top-25 rankings by
Opportunity Score and by MLI, and a **state leaderboard** (counties in the
national top 100). Runs automatically after the scanner (via the `.command`).

### 2.4 Parcel Scout (`tools/parcel_scout.py`) — Engine 3
The bottom-up automation. For a chosen county it pulls **every vacant-land
parcel** from the free **NYS statewide parcel** ArcGIS service (owner, mailing
address, acreage, zoning class, assessed value, utilities — no key), scores each
as a **mailing lead** (absentee owner + sellable size + cheap entry, with
corporate owners down-weighted), and auto-runs the **free diligence kill-gates**
(FEMA flood, USFWS wetland, USGS slope) on the top N. Outputs a sortable HTML +
CSV of pre-screened leads ready for the Deal Analyzer. This is the free,
per-county version of research Modules 3–4. *Verified live: 2,058 vacant parcels
in Genesee Co, 1,468 absentee-owned.* (Full methodology in
[METHODOLOGY.md](METHODOLOGY.md).)

### 2.4 Study material (`study/`)
- **Operator Playbook** — 3 exit strategies (wholesale/flip/seller-finance), the
  12-stage deal pipeline, key numbers, the #1 way beginners lose money, legal notes.
- **Due Diligence Checklist** — staged gates (cheapest free checks first), with the
  free tools for each and a 5-minute desktop-screen version.

---

## 3. Data sources (all free, no API key)

| Source | File / URL | Provides | Notes |
|--------|-----------|----------|-------|
| **Redfin Data Center** | `county_market_tracker.tsv000.gz` (S3) | Median price, price YoY, sales YoY, **months of supply**, **median DOM**, inventory, market heat — monthly, per county, ~173 months history | 241 MB, cached. **Residential** data (proxy for land demand) |
| **Census Building Permits Survey** | `co{year}a.txt` | New housing units permitted per county (2024 + 2025) | Construction = where building is happening |
| **Census Population Estimates** | `co-est2024-alldata.csv` | County population + 2020→2024 growth | Most fundamental demand driver |

**Merge mechanism:** Census data is keyed by FIPS; Redfin by "County, ST". We
build a `(normalized county name, state abbrev) → FIPS` crosswalk from the Census
population file. **Match rate: 99.3% (1,997 / 2,011 counties).**

Caching: downloads land in `tools/data/`, refreshed if older than 7 days, or
forced with `python3 county_scanner.py --refresh`.

---

## 4. The scoring model (current — v3, liquidity-first) ✅ VALIDATED

Rebuilt 2026-06-17 to match the blueprint's **Market Liquidity Index** and our
own backtest finding (§5). **Z-score standardized** (the blueprint's method —
preserves distribution shape, handles outliers far better than percentile/
min-max; winsorized to ±3 sd so one county can't dominate). **Two stages:**

**Stage 1 — Market Liquidity Index (MLI):** pure liquidity, the "king metric"
land flippers sell on. Weighted toward absorption + velocity:

| MLI metric | Weight | Better when | Source | Blueprint variable |
|------------|-------:|-------------|--------|--------------------|
| Months of inventory | 40% | lower | Redfin | Months of Inventory (MOI) |
| Days on market | 40% | lower | Redfin | Days on Market (DOM) |
| Sale-to-list ratio | 20% | higher | Redfin | List-to-Sale Ratio (LSR) proxy |

**Stage 2 — Opportunity score (headline):** liquidity-dominant, fundamentals +
affordability as support. **No momentum** (price/sales growth, heat = 0 weight)
— §5 proved it doesn't predict.

| Score metric | Weight | Better when | Source |
|--------------|-------:|-------------|--------|
| **Market Liquidity Index (Stage 1)** | **60%** | higher | (above) |
| Population growth (4yr) | 15% | higher | Census pop |
| Construction intensity (permits/1k) | 10% | higher | Census permits |
| Affordable entry (median price) | 15% | lower | Redfin |

Both composites are reported as readable 0–100 percentiles. Weights live at the
top of `county_scanner.py`. **Dropped vs v2:** price YoY, sales YoY, market heat
(momentum, mean-reverting), and permit growth (noisy small-sample) — all now
shown as *context* columns but earning **0 score weight**.

**Still a residential proxy.** The one remaining MLI variable we can't yet build
free is **Price-per-Acre Variance** (needs land comps) — reserved for the paid
phase.

---

## 5. Calibration — the key finding ✅ RESOLVED

We backtest with Redfin's 173 months of history: rank counties using only data
available N months ago, then measure what *actually happened* over the next N.

**Round 1 (v1/v2 score vs. price appreciation): no signal.**
- Spearman: **−0.003** (12mo), **+0.053** (24mo) — negligible.
- Bottom score decile appreciated *more* than the top. We were testing the wrong
  outcome (price), and momentum mean-reverts (rewarding it = buying near the top).

**Round 2 (v3 MLI vs. forward LIQUIDITY — the right outcome): strong signal.** ✅
Re-aimed `backtest.py` at what flippers actually sell on: realized average
months-of-supply and days-on-market over the following N months.

| Horizon | MLI → fwd months-supply | MLI → fwd DOM | MLI → fwd price (contrast) |
|---------|------------------------:|--------------:|---------------------------:|
| 12 mo   | **−0.73** | **−0.74** | −0.03 (≈0) |
| 24 mo   | **−0.75** | **−0.76** | +0.01 (≈0) |

Negative = high MLI predicts *faster-selling* markets. The decile table is
cleanly monotonic: **top-decile markets absorbed ~7 months faster and sold ~76
days quicker** than bottom-decile. The near-zero price correlation is the proof
of thesis: **liquidity persists and is forecastable; appreciation mean-reverts.**

**Caveat (honest):** liquidity is autocorrelated — tight markets tend to stay
tight — so part of −0.75 is persistence. That's *the point*: it makes liquidity
a reliable basis for site selection in a way appreciation never was.

**Conclusion:** the model is now **validated against the outcome that matters.**

---

## 6. Research — the best way to evaluate a land market

Web research into how experienced land investors evaluate markets. Headline:
**they optimize for liquidity and deal flow, NOT price appreciation** — which
independently confirms our backtest finding.

### The professional checklist (with thresholds)
- **Sell-Through Rate (STR) = Sold ÷ Active land listings.** The king metric.
  Sweet spot **0.75–1.5**. Too high (6–8) = too hot, no deals; too low = illiquid.
  (Mathematically the inverse of **months of inventory**, which we already compute.)
- **Days on Market** — target land selling in **30–60 days**; >18 months = dead.
- **Listing volume / deal flow** — moderate is best: **~600 active** = healthy,
  **<8** = too thin to comp/mail, **3,000+** = oversupply.
- **Population & job growth** — net in-migration, Sun Belt, **60–90 min from a
  metro**, unemployment below national average, diverse employers.
- **Price-per-acre trend + Coefficient of Variation** — lower price dispersion =
  more predictable pricing = easier to comp & offer (PRYCD core variable).
- **Property taxes** — dual signal: higher vacant-land taxes = more motivated
  sellers (mail targets) AND higher holding cost.

### The method: two stages
1. **Top-down** — rank states → counties on fundamentals + liquidity. *(Our
   scanner already does this — correct architecture.)*
2. **Bottom-up** — on the shortlist, pull **live land listings + sold land comps**
   to confirm STR/DOM/price before mailing.

### Tools the pros use
PRYCD, LandApp / Land Portal, AcreValue (data + pricing); LandWatch / Lands of
America (raw listings).

### Sources
- RETipster — [7 Market Research Terms](https://retipster.com/7-market-research-terms/),
  [Best Markets for Land Investing](https://retipster.com/best-markets-land-investing/),
  [Sell-Through Rate Explained](https://retipster.com/terms/sell-through-rate-str/),
  [PRYCD Review](https://retipster.com/prycd-review/)
- [LandApp — Finding the Best Markets](https://www.landapp.com/post/how-to-find-the-best-markets-for-land-investing)
- [Pebble — Determining Land Value](https://www.pebblerei.com/blog/determining-land-value)
- [PRYCD — Pricing Schemes](https://www.prycd.com/pricing-schemes-read-more)

---

## 7. How this maps to the `deep research.md` blueprint

The external blueprint specifies a **Market Liquidity Index (MLI)** built from:
List-to-Sale Ratio, Days on Market, Months of Inventory, and Price-per-Acre
Variance — Z-score normalized, weighted toward DOM and MOI (liquidity).

This is the **same conclusion** our research reached: **liquidity-first scoring.**
Our scanner is a working, free, simplified first version of that engine. To move
toward the blueprint we need to: (a) re-weight toward liquidity, (b) switch from
residential to **land-specific** listing data, and (c) add price-per-acre variance
(the Coefficient of Variation).

| Blueprint MLI variable | Our scanner today | Gap |
|------------------------|-------------------|-----|
| Months of Inventory | ✅ in MLI @ 40% (residential) | want land-specific |
| Days on Market | ✅ in MLI @ 40% (residential) | want land-specific |
| List-to-Sale Ratio | ✅ in MLI @ 20% (sale-to-list) | want land-specific |
| Z-score normalization | ✅ implemented | — |
| Price-per-Acre Variance (CoV) | ❌ | compute from land comps (paid phase) |

**The scanner now *is* a working free MLI** — same structure, same Z-score
method, same liquidity weighting as the blueprint. The only remaining gap is the
data layer (residential → land-specific) and the 4th variable (CoV).

---

## 8. Coverage vs. the professional checklist

| Criterion | Status | Closing the gap |
|-----------|--------|-----------------|
| Growth (population, construction) | ✅ Done | optionally add jobs/unemployment (BLS, free) |
| Liquidity (months-supply, DOM, sale-to-list) | ✅ MLI built & **validated** (ρ≈−0.75) | residential proxy → want land-specific STR |
| Deal flow (listing counts) | ❌ Missing | land listing counts (LandWatch / paid) |
| Property taxes | ❌ Missing | Census ACS median property tax (free) |
| Price predictability (CoV) | ❌ Missing | compute once land comps available |

---

## 9. Roadmap / next steps

**Immediate (free, high value):**
1. ✅ **DONE (2026-06-17)** — Re-targeted the score to a liquidity-first **MLI**
   (months-supply + DOM + sale-to-list, Z-scored), dropped the momentum tilt, and
   re-ran the backtest against forward liquidity. **Validated: ρ ≈ −0.75** (§5).
2. ✅ **DONE (2026-06-17)** — Added the **Acreage Decay Curve + blind-offer
   matrix** to the Deal Analyzer (Module 2). Decay-adjusted comps, dynamic
   25–40% discount, blind-offer-vs-MAO unification.
3. **Add Census property-tax data** (free) — seller motivation + holding cost.
   (Would also feed the analyzer's tax-delinquency distress modifier automatically.)

**Then:**
3. ✅ **DONE (2026-06-18)** — **L2 parcel puller** built as **Parcel Scout**:
   pulls vacant parcels (owner, mail addr, acreage, zoning, assessed value) from
   the free NYS parcel ArcGIS API, scored as mailing leads.
4. ✅ **DONE (2026-06-18)** — **L4 auto-diligence** built into Parcel Scout:
   auto-flags flood (FEMA), wetland (USFWS), and slope (USGS) on the top leads.
   Landlock check (OSM roads) still to add.
5. **CRM / pipeline** to track leads through the funnel.

**When scaling (paid):**
6. **Land-specific listing + sales data** (Regrid/ATTOM/PRYCD) → true land STR,
   price-per-acre variance, owner contacts nationwide.

---

## 10. Decisions & constraints log

- **2026-06-16/17** — Project kickoff. Chose: web-app tools, non-coder support,
  build study + tools in parallel.
- Delivery format: **single-file double-click** apps; Python via macOS system
  `python3` (3.9), stdlib only.
- Data: **free first, validate, then pay.** On-demand runs, not a hosted service.
- Built Deal Analyzer, Operator Playbook, Diligence Checklist.
- Built County Scanner (Redfin), then enriched with Census permits + population.
- Built calibration backtest → **found the score doesn't predict appreciation**;
  research confirmed **liquidity/STR is the right target.** Next build re-aims at it.
- `deep research.md` (user-provided) independently specifies the same
  liquidity-first **Market Liquidity Index** — it's effectively our target spec.
- **2026-06-17 (later)** — Rebuilt the scanner to **v3 liquidity-first MLI**
  (Z-scored months-supply 40% / DOM 40% / sale-to-list 20%; opportunity score =
  MLI 60% + pop growth 15% + construction 10% + affordability 15%; momentum
  dropped to 0). Re-aimed `backtest.py` at **forward liquidity** → **validated at
  ρ ≈ −0.75** (vs ~0 for the old price test). Model now predicts the right
  outcome. Decided next model build = Acreage Decay Curve + blind-offer matrix.
- **2026-06-17 (later still)** — Built **Module 2** into the Deal Analyzer:
  acreage decay curve (fits `PPA=a·acres^b` from comps, re-prices each comp to
  the subject's size — verified a 2/5/40-acre comp set converges to ~$3,975/ac
  for a 20-ac subject vs a naive $6,667/ac that would overprice by ~68%) and the
  blind-offer discount matrix (base 32% + tier/velocity/distress, clamped 25–40%,
  $/acre floor). Unified the two offer philosophies: **blind offer = mail it,
  MAO = walk-away ceiling, recommended opening = the lower of the two.**
- **2026-06-18** — Built **Parcel Scout** (Engine 3, research Modules 3–4, free):
  per-county vacant-parcel puller + lead scoring + auto-diligence. Chose the
  **free NYS statewide parcel ArcGIS API** as the data source after confirming
  several top-MLI counties (Genesee, Wayne, Livingston) are in it and it carries
  owner + **mailing address** (no paid skip-trace needed for mail in NY). Default
  target **Genesee County**. Down-weighted corporate owners after live results
  surfaced cell-tower/ag-LLC owners at the top. Honest gap: FEMA/USFWS were
  unreachable from the build sandbox (tool degrades to "CHECK"); they're public
  and work from a normal Mac. USGS slope verified working.
- **2026-06-18** — Added **METHODOLOGY.md** consolidating the full model math
  (MLI, decay curve, blind-offer matrix, lead scoring, diligence, validation),
  plus a browser version **methodology.html** (styled, double-click).
- **2026-06-18** — Made Parcel Scout's CSV **mail-ready**: added co-owner +
  full mailing street/PO box/zip to the export (NY parcel data carries owner name
  + mailing address = free direct mail; only phone/email need paid skip-trace).
- **2026-06-18** — Built **County Scores Report** (`county_report.py`): curated
  starter-market shortlist + rankings + state leaderboard from the scanner CSV,
  auto-generated after each scan. Top starters (Monroe/Wayne/Livingston NY,
  Tippecanoe IN, Cumberland PA, Kent MI) align with the Parcel Scout coverage.
