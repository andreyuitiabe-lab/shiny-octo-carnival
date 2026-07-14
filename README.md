# Land Flipping — Project Hub

Tools and study material for starting a land wholesaling / flipping business.

> 📓 **Full project documentation** — what we built, the data behind it, the
> calibration findings, and the research — lives in [PROJECT-LOG.md](PROJECT-LOG.md).
> 🧮 **Model methodology** — the logic & math behind every engine, plus the
> validation results — lives in [METHODOLOGY.md](METHODOLOGY.md)
> (or double-click **[methodology.html](methodology.html)** to read it in your browser).

## 📂 What's here

```
Land Flipping/
├── README.md                        ← you are here
├── METHODOLOGY.md                   ← the logic & math behind every engine (Markdown)
├── methodology.html                 ← same, formatted for the browser — double-click
├── app/
│   ├── deal-analyzer.html           ← analyze ONE parcel — double-click to open
│   ├── lead-manager.html            ← CRM: upload phone lists, stack, call, track the pipeline
│   └── offer-engine.html            ← seller replied? address → parcel + satellite → value → offer
├── tools/
│   ├── Run County Scanner.command   ← find WHERE to hunt — double-click to run
│   ├── county_scanner.py            ← scanner engine (Redfin + Census permits + population)
│   ├── county_report.py             ← turns the scores into a readable report (starter markets, leaderboards)
│   ├── Run Parcel Scout.command     ← pull + pre-screen a county's vacant parcels — double-click
│   ├── parcel_scout.py              ← parcel puller + lead scoring + auto-diligence (NY counties)
│   ├── Run Satellite Scout.command  ← vet the top leads from the sky — double-click
│   ├── satellite_scout.py           ← satellite gallery + land cover + road access + EYEBALL score
│   ├── backtest.py                  ← calibration: does the score predict outcomes?
│   └── output/                      ← generated reports (.html) + data (.csv + satellite images)
└── study/
    ├── 01-operator-playbook.md      ← how the business works, start to finish
    ├── 02-due-diligence-checklist.md← the gates every parcel must pass
    ├── 03-wholesale-process-playbook.md ← the wholesale deal, phone call to paycheck
    └── 04-seller-call-scripts.md    ← word-for-word scripts: cold call, callbacks, negotiation
```

## 🚀 How to use the Deal Analyzer (no coding needed)

1. Open the `app` folder in Finder.
2. **Double-click `deal-analyzer.html`** — it opens in your web browser.
3. Fill it in top to bottom:
   - **1 · Parcel** — name, county, acreage, any back taxes.
   - **2 · Comps** — type in 3–6 recently *sold* similar parcels. It fits an
     **acreage decay curve** and re-prices each comp to *your* acreage before
     averaging, so a 2-acre comp doesn't overvalue your 40-acre parcel.
   - **3 · Offer** — your costs feed the **Max Allowable Offer (MAO = your ceiling)**,
     and the **Blind Offer** (a dynamic 25–40% discount that auto-adjusts for
     parcel size, market speed, and seller distress) = the opening offer you mail.
   - **4 · Diligence gates** — mark each check (links to FEMA, wetlands, etc. are built in).
   - **5–6** — read the numbers and the **GO / CAUTION / KILL** verdict.
4. Click **💾 Save deal** to keep it. Saved deals appear at the bottom — click to reload.

> Your deals are saved inside that browser on this computer. Use the same
> browser to see them again. (We can upgrade to cloud sync later.)

## 🔎 How to use the County Opportunity Scanner (find WHERE to hunt)

1. Open the `tools` folder in Finder.
2. **Double-click `Run County Scanner.command`.** A Terminal window opens and runs it.
   - First run downloads ~241MB of free Redfin market data (one time). Later runs
     reuse the cached copy and finish in seconds.
3. When it's done, two things are generated and the **scores report** opens:
   - **`county-scores-report.html`** — a readable report: the best *starter
     markets* (liquid + affordable + real deal flow), top-25 rankings, and a
     state leaderboard. Start here.
   - **`county-opportunities.html`** — the full interactive table of all ~2,000
     counties (linked from the report) to sort/filter/search yourself.
4. In the table, sort by the **Land-Flip Score** (population growth 40% + builder
   activity 35% + cheap entry 25% — where the spread lives), or by **Hidden
   Opportunity** to *escape the obvious* — counties with real demand but **low
   competition** (the "next ring out" of growing metros, where you're not fighting
   hedge funds). Filter by **state**, **legal status**, or **⭐ under-the-radar
   picks**. The **MLI** column is a secondary "is the market frozen?" check, *not*
   the land-flip signal. (The MLI is validated vs forward
   liquidity at ρ≈−0.75; the Land-Flip Score is thesis-driven, pending land-data
   validation — see [METHODOLOGY.md](METHODOLOGY.md).)

> The scanner uses *housing-market* health as a proxy for land demand (it's the
> best free signal). It tells you WHERE to look. The **Deal Analyzer** tells you
> whether a SPECIFIC parcel is a deal. Use them together.

## 🛰️ How to use Parcel Scout (pull + pre-screen a county's vacant parcels)

1. Open the `tools` folder in Finder.
2. **Double-click `Run Parcel Scout.command`.** A Terminal window opens, pulls
   every vacant-land parcel in the county (default **Genesee, NY**), scores each
   as a mailing lead, and auto-runs free flood/wetland/slope checks on the top leads.
3. The report opens in your browser. Filter to **Individuals only** + **Out of
   state**, sort by **Lead**, and exclude **KILL** gates to get your warm list.
   Each row has owner, mailing address (for direct mail), acreage, assessed value,
   and a map link.
4. To scan a different county, edit the `COUNTY="Genesee"` line inside the
   `.command` file. Works for any of the 38 free NY counties (Wayne, Livingston,
   Ontario, Steuben…). Nationwide coverage is the paid path — see METHODOLOGY.md.

> Parcel Scout finds and ranks *candidate* parcels automatically. It does **not**
> value them — drop the promising ones into the **Deal Analyzer** and add sold
> comps to get a real offer.

## 🛰️ How to use Satellite Scout (vet the top leads from the sky)

1. Run **Parcel Scout** first (it produces the ranked list this tool reads).
2. **Double-click `Run Satellite Scout.command`.** For each top lead it downloads
   a satellite close-up with the **parcel boundary drawn on it**, samples the
   **Sentinel-2 10 m land-cover** map inside the parcel (🌾 open / 🌲 trees / 💧 wet),
   measures **road access** (frontage vs distance — the free landlocked check),
   and blends it all into an **EYEBALL score (0–100)**: would a buyer like what
   they see from the air?
3. A photo gallery opens. Flip through, hit **✓ Keep** on parcels that look good
   and **✗ Reject** on the wet/landlocked/ugly ones, then **⬇ Export kept as CSV**.
4. Send that CSV to a skip-tracing service to get the owners' phone numbers, and
   import the result into the **Lead Manager** to start calling.
5. County and lead count are the `COUNTY=` / `TOP=` lines inside the `.command` file.

## 📇 How to use the Lead Manager (your CRM — lists, calls, pipeline)

1. **Double-click `app/lead-manager.html`.**
2. **📥 Import List** — drop any CSV: a skip-traced phone list, a Parcel Scout
   output, or any spreadsheet. It auto-maps the columns (fix anything it guessed
   wrong), dedupes, and **stacks** leads that appear on more than one list (🔥 —
   stacked leads convert several times better, so call them first).
3. **📞 Call Mode** — works through your queue one lead at a time (due follow-ups
   first, then stacked, then score): click-to-call numbers, your script with the
   owner's details filled in, and one-tap dispositions (no answer / wrong number /
   interested / offer made / DNC…). Every call is logged automatically.
4. **📋 Leads** — search, filter, sort the whole database; click a lead for the
   full record (phones, property, mailing address, notes, activity history).
5. **🗄️ Lists & Backup** — manage imported lists, download a JSON backup
   (do this after big call sessions!), export everything to CSV.

> ⚖️ Before any calling session, scrub your list against the National
> Do-Not-Call Registry (telemarketing.donotcall.gov). Leads marked 🚫 DNC in the
> app are excluded from Call Mode automatically — that's your internal DNC list.

## ⚖️ How to use the Offer Engine (seller replied — what do I offer?)

Built for the mass-texting workflow: someone replies positively, you have an
address or a name — 3 minutes later you have your numbers.

1. **Double-click `app/offer-engine.html`.**
2. **1 · Find the parcel** — pick the state (Tennessee & New York query the free
   statewide parcel services; anywhere else use Manual), type the address, owner
   name, or APN, and click the right match.
3. **2 · The parcel** — it pulls the official record automatically: owner, deed
   acres (plus GIS-measured acres when the deed field is empty), a satellite
   photo with the boundary drawn on it, land cover (🌾/🌲/💧 + a 🏠 flag if a
   structure is likely), road frontage, **septic suitability (USDA soils —
   the silent deal-killer for rural lots)**, mapped wetlands (USFWS), slope
   (USGS), and FEMA flood zone (when their service is up). Links to Google
   satellite, FEMA flood map, and the county assessor.
4. **3 · What is it worth** — quick mode (type the typical asking $/acre from
   the comp links it gives you) or comp mode (2–6 real sales — it fits the
   acreage decay curve like the Deal Analyzer). Asking prices are auto-discounted.
   For TN parcels it builds a **🏛 SOLD deed-records link** (TPAD, pre-filled:
   your county, last 18 months, sorted by sale date) — real recorded sales, one
   click away. The sales portals block robots, so this last click is yours.
5. **4 · Your three numbers** — 🎯 opening offer · ✅ target · 🛑 walk-away (MAO).
   Tick the distress boosters (back taxes, inherited, expired listing…) to push
   the opening lower. Type what the seller asked for and it tells you
   **PURSUE / NEGOTIATE / WALK** with the gap. Copy the summary into the lead's
   notes in the Lead Manager.

> The engine's estimate is a *screening* number built from asking prices.
> Before you sign a contract, confirm with 3+ SOLD comps in the Deal Analyzer.

## 📖 How to study

1. Read `study/01-operator-playbook.md` — the whole business model.
2. Read `study/02-due-diligence-checklist.md` — memorize the deal-killers.
3. Read `study/03-wholesale-process-playbook.md` — the wholesale deal step by
   step: seller call, contract, finding the buyer, assignment, closing.
4. Read `study/04-seller-call-scripts.md` — word-for-word phone scripts for
   cold calls, owner callbacks, and the offer/negotiation call.
5. Pick **one county**, open its GIS + tax-assessor websites, and find 3 real
   vacant parcels. Run them through the Deal Analyzer. That's the real practice.

## ⚠️ Disclaimer

Educational tools, **not legal or financial advice**. Wholesaling rules vary by
state. Confirm title, access, and contracts with a real estate attorney or
title company before you close on anything.

## 🛣️ Where we can take this next

- Comp puller / parcel-data lookup automation
- Direct-mail list + offer-letter generator
- Interactive parcel maps for buyers
- Nationwide parcel coverage (paid: Regrid/ATTOM) once NY validates the model
- Cloud version so your deals & leads sync across devices
