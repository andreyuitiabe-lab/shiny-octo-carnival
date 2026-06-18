# Land Flipping — Model Methodology

> The complete logic and math behind the model, in one place. Companion to
> [PROJECT-LOG.md](PROJECT-LOG.md) (what we built & when) and
> [deep research.md](deep%20research.md) (the external blueprint this implements).
> Last updated **2026-06-18**.

The model answers three questions, in order:

1. **Where do I hunt?** → *Market Liquidity Index* (Engine 1)
2. **Which parcels do I mail?** → *Parcel Scout* lead scoring + auto-diligence (Engine 3)
3. **How much do I offer?** → *Acreage Decay Curve + Blind-Offer Matrix* (Engine 2)

Everything below is built on **free, no-key data** and runs on the Python/browser
that ship with macOS. The design principle throughout: **optimize for liquidity
(how fast land sells), not price appreciation** — this is what land flippers
actually profit on, and it is the one thing our backtest could validate.

---

## Engine 1 — Market Liquidity Index (MLI): *where to play*

Ranks ~2,000 U.S. counties. Implemented in [`tools/county_scanner.py`](tools/county_scanner.py).

### Inputs (free)
- **Redfin Data Center** — residential market metrics per county (proxy for land
  demand; the best free signal). Months of supply, days on market, sale-to-list.
- **Census** — population estimates (4-yr growth) and Building Permits Survey.

### Normalization: Z-score (not percentile or min-max)
Each metric *m* for county *i* is standardized against all counties:

```
z_i = (m_i − μ) / σ          winsorized to the range [−3, +3]
```

We use Z-scores (the blueprint's choice) because they **preserve the shape of the
distribution** and tolerate the extreme outliers ubiquitous in real-estate data;
percentile ranking throws away magnitude, and min-max is hostage to one outlier.
Winsorizing at ±3σ stops a single freak county from dominating. A missing value
scores 0 (the mean = neutral).

### Stage 1 — the liquidity sub-index (the "king metric")
Pure liquidity, weighted toward absorption and velocity:

| Variable | Weight | Direction | Blueprint name |
|----------|-------:|-----------|----------------|
| Months of inventory | 0.40 | lower is better (inverted z) | Months of Inventory |
| Days on market | 0.40 | lower is better (inverted z) | Days on Market |
| Sale-to-list ratio | 0.20 | higher is better | List-to-Sale Ratio (proxy) |

```
MLI_raw = 0.40·(−z_months) + 0.40·(−z_dom) + 0.20·(z_sale_to_list)
```

The 4th blueprint variable — **Price-per-Acre Variance (CoV)** — needs land-level
comps and is reserved for the paid phase.

### Stage 2 — the headline Opportunity Score
Liquidity-dominant, with fundamentals and affordability as support. **No price/
sales momentum** — the backtest showed momentum doesn't predict and mean-reverts,
so it earns 0 weight (it is still *displayed* as context):

| Component | Weight | Direction |
|-----------|-------:|-----------|
| **MLI (Stage 1)** | **0.60** | higher is better |
| Population growth (4-yr) | 0.15 | higher is better |
| Construction intensity (permits/1k pop) | 0.10 | higher is better |
| Affordable entry (median price) | 0.15 | lower is better |

```
Score_raw = 0.60·z(MLI) + 0.15·z(pop_growth) + 0.10·z(permits) + 0.15·(−z_price)
```

Both `MLI_raw` and `Score_raw` are converted to a readable **0–100 percentile**
for display and sorting.

### Validation (this is the important part)
Walk-forward backtest in [`tools/backtest.py`](tools/backtest.py): rank counties
by MLI using **only** data available *N* months ago, then measure the **realized
forward liquidity** (average months-of-supply and days-on-market over the next *N*
months). Result on Redfin's 173-month history:

| Horizon | MLI → forward months-supply | MLI → forward DOM | MLI → forward *price* (contrast) |
|---------|----------------------------:|------------------:|---------------------------------:|
| 12 mo   | **−0.73** (Spearman ρ) | **−0.74** | −0.03 |
| 24 mo   | **−0.75** | **−0.76** | +0.01 |

Negative = a high MLI today predicts a **faster-selling** market tomorrow. Top-
decile MLI markets absorbed ~7 months faster and sold ~76 days quicker than
bottom-decile. The near-zero price correlation is the proof of thesis:
**liquidity persists and is forecastable; appreciation mean-reverts and is not.**

*Honest caveat:* liquidity is autocorrelated (tight markets tend to stay tight),
so part of −0.75 is persistence — which is exactly why it makes a reliable basis
for site selection where appreciation never did.

---

## Engine 2 — Parcel pricing: *how much to offer*

For a single parcel. Implemented in [`app/deal-analyzer.html`](app/deal-analyzer.html).

### 2a — Acreage Decay Curve (valuation)
Land does **not** price linearly per acre — a big parcel is worth less *per acre*
than a small one. Value follows a power law:

```
PPA = a · acres^b          (b is negative; the "decay exponent")
```

We fit `b` from your comps by ordinary least squares on the log-log form
(`ln(PPA) = ln(a) + b·ln(acres)`), requiring ≥3 comps across ≥2 distinct sizes;
otherwise we fall back to a default `b = −0.35`. `b` is clamped to `[−0.8, 0]`.

Each comp is then **re-priced to the subject parcel's acreage** before averaging:

```
PPA_subject(comp i) = PPA_i · (acres_subject / acres_i)^b
EMV = mean_i( PPA_subject(comp i) ) · acres_subject
```

This is the core fix: it normalizes mixed-size comps onto one curve. *Worked
example:* comps of 2 ac ($10k/ac), 5 ac ($7k/ac) and 40 ac ($3k/ac) all converge
to ≈$3,975/ac for a 20-ac subject (EMV ≈ $79.5k) — versus a naive flat average of
$6,667/ac that would over-value it by ~68%.

Parcels are also bucketed into 4 geometric tiers (1–5 / 5–10 / 10–20 / 20+ ac),
which feed the discount matrix below.

### 2b — Blind-Offer Matrix (the offer you mail)
The opening offer is a dynamic discount off EMV:

```
Offer_blind = EMV · (1 − D)
```

`D` = a base wholesale margin plus situational modifiers, **clamped to [25%, 40%]**:

| Component | Condition | Δ on discount |
|-----------|-----------|--------------:|
| Base | every parcel | +0.32 |
| Acreage tier | Tier 1 (1–5 ac) | −0.04 |
|  | Tier 2 (5–10 ac) | 0.00 |
|  | Tier 3 (10–20 ac) | +0.02 |
|  | Tier 4 (20+ ac) | +0.05 |
| Market velocity | DOM < 45 days (hot) | −0.04 |
|  | DOM ≥ 120 days (slow) | +0.03 |
| Seller distress | taxes > 1 yr delinquent | +0.05 |

```
D = clamp( 0.32 + tier + velocity + distress,  0.25,  0.40 )
Offer_blind = max( EMV·(1−D),  floor_$/acre · acres )    # a $/acre floor prevents absurd lowballs
```

Tier 1 gets a *smaller* discount (compete harder on small, liquid lots); Tier 4 a
*deeper* one (more capital at risk). Hot markets compress the discount; distress
widens it.

### 2c — Unifying the two offer philosophies
- **Blind offer** = what you *mail* (the opening, from the matrix above).
- **Maximum Allowable Offer (MAO)** = your *walk-away ceiling*, worked backward
  from the exit: `MAO = resale − costs − target_profit`.
- **Recommended opening** = `min(Offer_blind, MAO)`.
- If `Offer_blind > MAO`, the margin is too thin (your opening already exceeds
  your ceiling) → the verdict flags **CAUTION** to tighten costs/comps or walk.

### Diligence gates → verdict
Each parcel passes staged gates. **Killer** gates (legal access, buildable
topography, zoning, flood, wetlands) force **KILL** on failure and hold at
**CAUTION** while unknown; non-killers raise **CAUTION**. With clear gates and
room between the blind offer and the MAO → **GO**.

---

## Engine 3 — Parcel Scout: *which parcels to mail* (automation)

Pulls and pre-screens every vacant parcel in a county, free.
Implemented in [`tools/parcel_scout.py`](tools/parcel_scout.py).

### Data source
**NYS statewide public parcel** ArcGIS service — free, no key, covers 38 NY
counties including the top-MLI land markets (Genesee, Wayne, Livingston, Ontario,
Steuben…). Vacant land is isolated by NYS property-class code `3xx`. Each parcel
returns owner name, **mailing address** (so in NY no paid skip-trace is needed for
direct mail), acreage, assessed value, and utility availability.

### Lead score (prioritization, *not* a buy signal)
```
Lead = 100 · ( 0.40·motivation + 0.25·size + 0.35·cheap )
```
- **motivation** = `1.0` if owner mails from out of **state**, `0.6` if out of
  **town**, else `0`. Multiplied by **0.3 if the owner is a corporation** (cell
  towers, ag LLCs, banks, governments are rarely motivated individual sellers).
- **size** = `1.0` for the liquid 2–20 ac band, `0.5` for 20+ ac, `0.3` otherwise.
- **cheap** = `1 − percentile(assessed $/acre)` — lower entry price ranks higher.
  (Assessed value is a free *proxy*; real value still comes from sold comps in the
  Deal Analyzer.)

### Auto-diligence (free, on the top N leads)
For the highest-ranked parcels, the centroid lat/lon is queried against three
free federal layers; any failure degrades to `?` (gate = CHECK) rather than
crashing:

| Gate | Source | KILL condition |
|------|--------|----------------|
| Flood | FEMA National Flood Hazard Layer | special-flood zone (A/AE/AO/V/…) |
| Wetland | USFWS National Wetlands Inventory | any wetland polygon intersects |
| Slope | USGS 3DEP elevation (4-point cross ≈110 m) | estimated slope > 15° |

Output is a sortable HTML report + CSV; gate-passing, individually-owned,
out-of-state leads float to the top, ready for the Deal Analyzer.

---

## Data sources (all free, no API key)

| Source | Feeds | Coverage |
|--------|-------|----------|
| Redfin Data Center | MLI liquidity + affordability | nationwide, monthly |
| Census Population Estimates | population & 4-yr growth | nationwide |
| Census Building Permits Survey | construction intensity | nationwide |
| NYS Public Parcel ArcGIS | parcel attributes, owner, mail addr | 38 NY counties |
| FEMA NFHL | flood-zone diligence | nationwide |
| USFWS NWI | wetland diligence | nationwide |
| USGS 3DEP (EPQS) | slope diligence | nationwide |

---

## Assumptions & limitations

- **Residential proxy.** The MLI uses residential liquidity as a stand-in for land
  liquidity (no free nationwide land-listing data exists). Validated as directional,
  not exact.
- **No free land comps.** Valuation in the Deal Analyzer still needs comps entered
  by hand; Parcel Scout's assessed-value proxy is for *ranking*, not offers.
- **Parcel data is per-county and NY-only for now.** Each state/county exposes a
  different (or no) free parcel API. National, one-click parcel + skip-trace is the
  **paid** path (BatchData + PRYCD, ≈$1,200/mo — research Modules 3–5).
- **Diligence is a desktop pre-screen.** FEMA/USFWS/USGS overlays flag likely
  problems; they don't replace a title search, survey, or on-the-ground check.
- **Not advice.** Educational tooling. Confirm title, access, and contracts with a
  title company or attorney before closing.
