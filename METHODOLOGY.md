# Land Flipping — Model Methodology

> The complete logic and math behind the model, in one place. Companion to
> [PROJECT-LOG.md](PROJECT-LOG.md) (what we built & when) and
> [deep research.md](deep%20research.md) (the external blueprint this implements).
> Last updated **2026-06-18**.

The model answers three questions, in order:

1. **Where do I hunt?** → *Land-Flip Score* (Engine 1)
2. **Which parcels do I mail?** → *Parcel Scout* lead scoring + auto-diligence (Engine 3)
3. **How much do I offer?** → *Acreage Decay Curve + Blind-Offer Matrix* (Engine 2)

Everything below is built on **free, no-key data** and runs on the Python/browser
that ship with macOS. The design principle throughout: **rank markets for the
land-flip spread (cheap land + active builders + population growth), not for how
fast existing homes resell** — resale velocity is nearly the opposite of land-flip
opportunity (mature metros resell fast but have no spread).

---

## Engine 1 — Land-Flip Score: *where to play*

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

### Headline — the Land-Flip Score (path of growth)
Land flipping profits on the **spread you capture in the path of growth** — buying
cheap raw land where development is pushing outward — *not* on existing homes
reselling fast. So the headline is built from the three drivers of that spread:

| Component | Weight | Direction | Why |
|-----------|-------:|-----------|-----|
| Population growth (4-yr) | 0.40 | higher is better | in-migration = the demand engine |
| Builder / construction activity (permits/1k) | 0.35 | higher is better | active builders absorbing land |
| Cheap entry (median price) | 0.25 | lower is better | margin needs a low basis |

```
LandFlip_raw = 0.40·z(pop_growth) + 0.35·z(permits/1k) + 0.25·(−z_price)
```

**Why not lead with liquidity?** An earlier version made the residential MLI 60%
of the headline — but that surfaced mature metros (e.g. Monroe Co NY: top MLI,
yet **−0.7% population growth**) which have little cheap land and no development
spread. Resale velocity is almost the *opposite* of land-flip opportunity. The
headline was rebuilt around the path-of-growth thesis; the Sun-Belt exurbs it now
ranks first (Horry SC, Bastrop/Hays/Montgomery TX, Sumter/Flagler FL, Pinal AZ)
are the classic land-flip markets.

### Secondary — the Market Liquidity Index (MLI)
Residential resale liquidity, kept as a **secondary column** — a "is this market
frozen or transacting?" sanity check, not the land-flip signal. Z-scored:

| Variable | Weight | Direction |
|----------|-------:|-----------|
| Months of inventory | 0.40 | lower is better (inverted z) |
| Days on market | 0.40 | lower is better (inverted z) |
| Sale-to-list ratio | 0.20 | higher is better |

```
MLI_raw = 0.40·(−z_months) + 0.40·(−z_dom) + 0.20·(z_sale_to_list)
```

Both composites are converted to a readable **0–100 percentile** for display.

### Third lens — Hidden Opportunity Score (escape the obvious)
The Land-Flip headline rewards exactly the signals *every* land investor uses
(growth + builders + cheap), so its top is the most **crowded** geography (Phoenix
exurbs, Tampa/Orlando rings, Austin). The Hidden Opportunity lens finds real
demand the crowd is missing:

```
Hidden = LandFlip_demand − Competition − ExitPenalty
```
- **Competition** (proxy, 0–100 percentile) = market **size/visibility**:
  `ln(population) + ln(homes_sold)`. Bigger, busier markets draw more investors.
  *(This is a proxy. True competition — investor purchase share, mail volume —
  needs paid data: ATTOM "investor purchases", PropStream.)*
- **ExitPenalty** = `max(0, 3 − permits_per_1k) · 6` — a soft penalty for thin
  builder activity, so we don't surface markets with no buyer (the "Custer trap":
  low competition but nobody to sell to).

A county flagged ⭐ **under-the-radar pick** has demand ≥ 70, competition ≤ 40, and
a real exit. In practice these are the **"next ring out"** from growing metros
(Trousdale TN↔Nashville, Gilchrist FL↔Gainesville, Linn KS↔Kansas City) plus
overlooked rural growers — strong fundamentals, competition 1–15 vs the obvious
top's 70–98.

> **Next step (logged):** a cleaner version is the **metro-ring model** — explicitly
> score small counties *adjacent* to a growing metro using free Census
> county-adjacency data, to catch the spillover before the crowd arrives.

### Validation status — read this carefully
- **The MLI (secondary) IS validated** as a *liquidity-persistence* signal. A
  walk-forward backtest ([`tools/backtest.py`](tools/backtest.py)) ranks counties
  by MLI using only past data, then measures realized forward liquidity:

  | Horizon | MLI → fwd months-supply | MLI → fwd DOM | MLI → fwd *price* (contrast) |
  |---------|------------------------:|--------------:|-----------------------------:|
  | 12 mo   | **−0.73** (ρ) | **−0.74** | −0.03 |
  | 24 mo   | **−0.75** | **−0.76** | +0.01 |

  High MLI predicts faster-selling markets; the ~0 price correlation shows
  liquidity persists while appreciation mean-reverts. *Caveat:* liquidity is
  autocorrelated, so part of −0.75 is persistence.

- **The Land-Flip Score (headline) is NOT yet empirically validated.** It is
  *thesis-driven* — it encodes how experienced land investors actually pick
  markets (cheap + builders + growth) — but we have not yet measured it against
  realized **land** outcomes, because that needs land-specific sale data (land
  STR / DOM), which is the paid/scraped next step. Treat it as a well-reasoned
  prior, not a proven predictor, until validated against land transactions.

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

## State legal layer (compliance flag) — *not legal advice*

Wholesaling is regulated at the **state** level, and the rules changed sharply in
2024–2025. The model attaches a legal-status badge to every county from its state
(a **flag, not a score input** — a great market in a restrictive state still shows
its true score, just badged so you verify with a local attorney). Snapshot,
mid-2026:

| Tier | States | Meaning |
|------|--------|---------|
| ⛔ **License req'd** | IL, OK, NC, KY, NE | A real-estate license is effectively required to wholesale |
| 🟧 **Register** | CT, OR | Must register with a state agency first |
| 🟨 **Disclosure** | OH, MD, IN, TX | Written seller disclosure required or the contract is voidable |
| ◐ **Marketing limits** | SC, MI, NY, CA, GA, IA, NJ, UT, WA | Can't publicly advertise a property you don't own; private assignment OK |
| ✅ **Clear** | all others | Generally permitted (use "and/or assigns", market privately) |

The scanner table and the County Scores Report show the badge and let you filter
out restrictive states; the data lives in `LEGAL` at the top of
`county_scanner.py` (easy to update as laws change). This implements the
"exclusion zones" idea from Module 5 of the blueprint. **These laws change fast
and edge cases are contested — always confirm with a licensed attorney in the
target state before operating.**

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
