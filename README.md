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
│   └── deal-analyzer.html           ← analyze ONE parcel — double-click to open
├── tools/
│   ├── Run County Scanner.command   ← find WHERE to hunt — double-click to run
│   ├── county_scanner.py            ← scanner engine (Redfin + Census permits + population)
│   ├── county_report.py             ← turns the scores into a readable report (starter markets, leaderboards)
│   ├── Run Parcel Scout.command     ← pull + pre-screen a county's vacant parcels — double-click
│   ├── parcel_scout.py              ← parcel puller + lead scoring + auto-diligence (NY counties)
│   ├── backtest.py                  ← calibration: does the score predict outcomes?
│   └── output/                      ← generated reports (.html) + data (.csv)
└── study/
    ├── 01-operator-playbook.md      ← how the business works, start to finish
    └── 02-due-diligence-checklist.md← the gates every parcel must pass
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
4. In the table, sort by **MLI** (how fast a market sells) or the **Opportunity
   Score** (liquidity-first: MLI 60% + growth + affordability), filter by
   **state**, or search a county. High MLI = land sells fast there. (Validated:
   the MLI predicts forward liquidity at ρ≈−0.75 — run `backtest.py` to see it.)

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

## 📖 How to study

1. Read `study/01-operator-playbook.md` — the whole business model.
2. Read `study/02-due-diligence-checklist.md` — memorize the deal-killers.
3. Pick **one county**, open its GIS + tax-assessor websites, and find 3 real
   vacant parcels. Run them through the Deal Analyzer. That's the real practice.

## ⚠️ Disclaimer

Educational tools, **not legal or financial advice**. Wholesaling rules vary by
state. Confirm title, access, and contracts with a real estate attorney or
title company before you close on anything.

## 🛣️ Where we can take this next

- Buyer/seller CRM & pipeline (track leads through the funnel)
- Comp puller / parcel-data lookup automation
- Direct-mail list + offer-letter generator
- Interactive parcel maps for buyers
- Cloud version so your deals sync across devices
