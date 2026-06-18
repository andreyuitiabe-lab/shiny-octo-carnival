#!/usr/bin/env python3
"""
County Opportunity Scanner  —  Land Flipping toolkit
=====================================================
Scores every U.S. county for how attractive it looks as a land-hunting market,
by merging THREE free, no-API-key data sources:

  1. Redfin Data Center  — housing-market health (price growth, sales, inventory
     tightness, selling speed, affordability).  Proxy for *demand & liquidity*.
  2. Census Building Permits Survey — new housing units permitted per county.
     Direct measure of *where construction / growth is happening*.
  3. Census Population Estimates — county population & multi-year growth.
     The most fundamental *demand* driver for land.

All free. No API key. Runs on the Python that ships with macOS.

Output:
  tools/output/county-opportunities.html   <- open this (interactive, sortable)
  tools/output/county-opportunities.csv    <- same data for Excel/Sheets

Usage:
  python3 county_scanner.py            # use cached data if recent, else download
  python3 county_scanner.py --refresh  # force fresh downloads

NOTE: the score is an expert-weighted heuristic. To check whether it actually
predicts outcomes, run  backtest.py  (calibrates against historical results).
"""

import csv, gzip, os, sys, time, unicodedata, urllib.request
from bisect import bisect_left

# ---------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
OUT_HTML = os.path.join(HERE, "output", "county-opportunities.html")
OUT_CSV = os.path.join(HERE, "output", "county-opportunities.csv")
CACHE_MAX_AGE_DAYS = 7
MIN_HOMES_SOLD = 10

REDFIN_URL = ("https://redfin-public-data.s3.us-west-2.amazonaws.com/"
              "redfin_market_tracker/county_market_tracker.tsv000.gz")
PERMITS_LATEST_YEAR = 2025
PERMITS_PRIOR_YEAR = 2024
PERMITS_URL = "https://www2.census.gov/econ/bps/County/co{year}a.txt"
POP_URL = ("https://www2.census.gov/programs-surveys/popest/datasets/"
           "2020-2024/counties/totals/co-est2024-alldata.csv")

# --- Scoring model (v3 — liquidity-first) ----------------------------------
# Two stages, both Z-score standardized (the blueprint's method: preserves the
# shape of the distribution and handles real-estate outliers far better than
# percentile or min-max scaling).
#
# Stage 1 — MARKET LIQUIDITY INDEX (MLI): the research's core index. PURE
# liquidity, weighted toward absorption (months of inventory) and velocity (days
# on market), with sale-to-list as the List-to-Sale-Ratio proxy. This is the
# "king metric" land flippers actually sell on.
#   (key, weight, higher_is_better, label)
LIQUIDITY_METRICS = [
    ("months_supply", 0.40, False, "Months of inventory"),
    ("dom",           0.40, False, "Days on market"),
    ("sale_to_list",  0.20, True,  "Sale-to-list ratio"),
]

# Stage 2 — OPPORTUNITY SCORE (headline): liquidity-dominant, with demand
# fundamentals + affordability as supporting context. NO price/sales momentum:
# our own backtest showed momentum does NOT predict outcomes (it mean-reverts),
# so it earns 0 weight here. 'mli' = the Stage-1 liquidity composite.
OPPORTUNITY_METRICS = [
    ("mli",            0.60, True,  "Market liquidity"),
    ("pop_growth",     0.15, True,  "Population growth (4yr)"),
    ("permits_per_1k", 0.10, True,  "Construction intensity"),
    ("price",          0.15, False, "Affordable entry"),
]

STATE_FIPS_TO_ABBR = {
    "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
    "11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
    "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
    "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
    "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
    "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
    "54":"WV","55":"WI","56":"WY","72":"PR",
}


def log(m): print(m, flush=True)


def fetch(url, cache_name, label, refresh=False):
    path = os.path.join(DATA, cache_name)
    fresh = (os.path.exists(path)
             and (time.time() - os.path.getmtime(path)) < CACHE_MAX_AGE_DAYS * 86400)
    if fresh and not refresh:
        return path
    log(f"Downloading {label}...")
    req = urllib.request.Request(url, headers={"User-Agent": "land-scanner/1.0"})
    with urllib.request.urlopen(req) as r, open(path, "wb") as f:
        total = int(r.headers.get("Content-Length", 0))
        got = 0
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
            got += len(chunk)
            if total > (1 << 22):
                sys.stdout.write(f"\r  {got*100//total:3d}%  ({got//(1<<20)}/{total//(1<<20)} MB)")
                sys.stdout.flush()
    if total > (1 << 22):
        sys.stdout.write("\n")
    return path


def norm_county(name):
    n = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    for suf in (" county", " parish", " borough", " census area",
                " municipality", " city and borough", " municipio", " city"):
        if n.endswith(suf):
            n = n[: -len(suf)]
            break
    return "".join(c for c in n if c.isalnum())


# ---------------------------------------------------------------------------
def load_population(refresh):
    """Return {fips: {pop, pop_growth}} and {(normname, abbr): fips} crosswalk."""
    path = fetch(POP_URL, "co-est2024.csv", "Census population estimates", refresh)
    pops, xwalk = {}, {}
    with open(path, "r", encoding="latin-1") as f:
        for row in csv.DictReader(f):
            if row.get("SUMLEV") != "050":   # 050 = county
                continue
            fips = row["STATE"].zfill(2) + row["COUNTY"].zfill(3)
            try:
                p20 = float(row["POPESTIMATE2020"]); p24 = float(row["POPESTIMATE2024"])
            except (ValueError, KeyError):
                continue
            growth = (p24 - p20) / p20 if p20 else None
            pops[fips] = {"pop": p24, "pop_growth": growth}
            abbr = STATE_FIPS_TO_ABBR.get(row["STATE"].zfill(2))
            if abbr:
                xwalk[(norm_county(row["CTYNAME"]), abbr)] = fips
    log(f"  population: {len(pops)} counties")
    return pops, xwalk


def load_permits(year, refresh):
    """Return {fips: total_units_permitted} for a given annual file."""
    path = fetch(PERMITS_URL.format(year=year), f"permits_{year}.txt",
                 f"Census building permits {year}", refresh)
    out = {}
    with open(path, "r", encoding="latin-1") as f:
        for line in f:
            parts = line.split(",")
            if len(parts) < 18 or not parts[0].strip().isdigit():
                continue
            try:
                fips = parts[1].strip().zfill(2) + parts[2].strip().zfill(3)
                # Units columns: 1-unit(7), 2-units(10), 3-4 units(13), 5+ units(16)
                units = sum(int(parts[i]) for i in (7, 10, 13, 16))
            except (ValueError, IndexError):
                continue
            out[fips] = units
    log(f"  permits {year}: {len(out)} counties")
    return out


def load_redfin(refresh):
    """Return {region: latest 'All Residential' row}."""
    path = fetch(REDFIN_URL, "county_market_tracker.tsv000.gz",
                 "Redfin county dataset (~241 MB, one-time)", refresh)
    log("Parsing Redfin (latest month per county)...")
    best = {}
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as fh:
        for row in csv.DictReader(fh, delimiter="\t"):
            if row.get("REGION_TYPE") != "county" or row.get("PROPERTY_TYPE") != "All Residential":
                continue
            region, period = row.get("REGION", ""), row.get("PERIOD_END", "")
            cur = best.get(region)
            if cur is None or period > cur[0]:
                best[region] = (period, row)
    log(f"  redfin: {len(best)} counties")
    return {r: v[1] for r, v in best.items()}


def fnum(row, key):
    v = row.get(key, "")
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
        return None


def percentile_ranker(values):
    n = len(values)
    def rank(v):
        if v is None or n == 0:
            return 0.5
        return bisect_left(values, v) / n
    return rank


def zscorer(values):
    """Return v -> winsorized z-score (mean 0, sd 1, clamped to +/-3 so a single
    outlier county can't dominate). Missing values score 0 (the mean = neutral)."""
    vals = [v for v in values if v is not None]
    n = len(vals)
    if n < 2:
        return lambda v: 0.0
    mean = sum(vals) / n
    sd = (sum((x - mean) ** 2 for x in vals) / n) ** 0.5
    if sd == 0:
        return lambda v: 0.0
    def z(v):
        if v is None:
            return 0.0
        return max(-3.0, min(3.0, (v - mean) / sd))
    return z


# ---------------------------------------------------------------------------
def build_records(refresh):
    pops, xwalk = load_population(refresh)
    permits_now = load_permits(PERMITS_LATEST_YEAR, refresh)
    permits_prev = load_permits(PERMITS_PRIOR_YEAR, refresh)
    redfin = load_redfin(refresh)

    records, matched = [], 0
    for region, row in redfin.items():
        homes = fnum(row, "HOMES_SOLD")
        if homes is None or homes < MIN_HOMES_SOLD:
            continue
        state = row.get("STATE_CODE", "")
        fips = xwalk.get((norm_county(region.split(",")[0]), state))
        pop = pops.get(fips, {}) if fips else {}
        pnow = permits_now.get(fips); pprev = permits_prev.get(fips)
        if fips and (pop or pnow is not None):
            matched += 1
        popv = pop.get("pop")
        rec = {
            "county": region, "state": state,
            "metro": row.get("PARENT_METRO_REGION", ""), "period": row.get("PERIOD_END", ""),
            "homes_sold": homes, "fips": fips or "",
            "m": {
                "price":         fnum(row, "MEDIAN_SALE_PRICE"),
                "price_yoy":     fnum(row, "MEDIAN_SALE_PRICE_YOY"),
                "sales_yoy":     fnum(row, "HOMES_SOLD_YOY"),
                "months_supply": fnum(row, "MONTHS_OF_SUPPLY"),
                "dom":           fnum(row, "MEDIAN_DOM"),
                "sale_to_list":  fnum(row, "AVG_SALE_TO_LIST"),
                "pop_growth":    pop.get("pop_growth"),
                "permits_per_1k": (pnow / popv * 1000) if (pnow is not None and popv) else None,
                "permit_growth": ((pnow - pprev) / pprev) if (pnow is not None and pprev) else None,
            },
            "pop": popv, "permits": pnow,
        }
        records.append(rec)

    log(f"  matched Census data to {matched}/{len(records)} Redfin counties")

    # --- Stage 1: Market Liquidity Index (pure liquidity, Z-scored) ----------
    liq_z = {k: zscorer([r["m"][k] for r in records]) for k, _w, _h, _l in LIQUIDITY_METRICS}
    for r in records:
        comp = 0.0
        for key, w, higher, _lbl in LIQUIDITY_METRICS:
            z = liq_z[key](r["m"][key])
            comp += w * (z if higher else -z)
        r["m"]["mli"] = comp          # raw z-composite; feeds Stage 2

    # --- Stage 2: Opportunity score (liquidity-dominant, Z-scored) -----------
    opp_z = {k: zscorer([r["m"][k] for r in records]) for k, _w, _h, _l in OPPORTUNITY_METRICS}
    for r in records:
        comp = 0.0
        for key, w, higher, _lbl in OPPORTUNITY_METRICS:
            z = opp_z[key](r["m"][key])
            comp += w * (z if higher else -z)
        r["opp_raw"] = comp

    # --- Convert both composites to readable 0-100 percentiles ---------------
    mli_rank = percentile_ranker(sorted(r["m"]["mli"] for r in records))
    opp_rank = percentile_ranker(sorted(r["opp_raw"] for r in records))
    for r in records:
        r["mli"] = round(mli_rank(r["m"]["mli"]) * 100, 1)
        r["score"] = round(opp_rank(r["opp_raw"]) * 100, 1)

    records.sort(key=lambda x: x["score"], reverse=True)
    for i, r in enumerate(records, 1):
        r["rank"] = i
    return records


def write_csv(records):
    cols = ["rank", "score", "mli", "county", "state", "metro", "homes_sold", "population",
            "pop_growth_4yr", "permits_2025", "permits_per_1k",
            "median_price", "months_supply", "median_dom", "sale_to_list",
            "price_yoy", "sales_yoy", "period"]
    with open(OUT_CSV, "w", newline="") as f:
        w = csv.writer(f); w.writerow(cols)
        for r in records:
            m = r["m"]
            w.writerow([r["rank"], r["score"], r["mli"], r["county"], r["state"], r["metro"],
                        int(r["homes_sold"]), int(r["pop"]) if r["pop"] else "",
                        m["pop_growth"], r["permits"] if r["permits"] is not None else "",
                        round(m["permits_per_1k"], 2) if m["permits_per_1k"] is not None else "",
                        m["price"], m["months_supply"], m["dom"], m["sale_to_list"],
                        m["price_yoy"], m["sales_yoy"], r["period"]])
    log(f"Wrote {OUT_CSV}")


def write_html(records):
    import json
    period = records[0]["period"] if records else "—"
    states = sorted({r["state"] for r in records if r["state"]})
    data = [{
        "rank": r["rank"], "score": r["score"], "mli": r["mli"],
        "county": r["county"], "state": r["state"],
        "metro": r["metro"], "homes": int(r["homes_sold"]),
        "pop": int(r["pop"]) if r["pop"] else None, "popGrowth": r["m"]["pop_growth"],
        "permits": r["permits"], "permitsK": r["m"]["permits_per_1k"],
        "price": r["m"]["price"],
        "priceYoy": r["m"]["price_yoy"], "soldYoy": r["m"]["sales_yoy"],
        "supply": r["m"]["months_supply"], "dom": r["m"]["dom"],
        "saleToList": r["m"]["sale_to_list"],
    } for r in records]
    html = (HTML_TEMPLATE.replace("__PERIOD__", period)
            .replace("__COUNT__", str(len(records)))
            .replace("__STATES__", json.dumps(states))
            .replace("__DATA__", json.dumps(data)))
    with open(OUT_HTML, "w") as f:
        f.write(html)
    log(f"Wrote {OUT_HTML}")


HTML_TEMPLATE = r"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>County Opportunity Scanner</title><style>
:root{--bg:#0f1419;--panel:#1a2129;--line:#2e3a46;--text:#e6edf3;--muted:#8b9bab;--accent:#58a6ff;--good:#3fb950;--warn:#d29922;--bad:#f85149}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
header{padding:18px 24px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#161d24,#0f1419)}
header h1{margin:0;font-size:20px}header .sub{color:var(--muted);font-size:13px;margin-top:4px}
.wrap{max-width:1360px;margin:0 auto;padding:18px 24px 80px}
.controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
input,select{padding:8px 11px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:8px;font-size:14px}
.muted{color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{padding:7px 9px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
th:nth-child(2),td:nth-child(2),th:nth-child(3),td:nth-child(3){text-align:left}
th{position:sticky;top:0;background:#161d24;cursor:pointer;user-select:none;color:var(--muted);font-weight:600}
th:hover{color:var(--text)}tr:hover td{background:#161d24}
.score{font-weight:700}.s-hi{color:var(--good)}.s-mid{color:var(--warn)}.s-lo{color:var(--muted)}
.pos{color:var(--good)}.neg{color:var(--bad)}
.bar{display:inline-block;height:8px;border-radius:4px;background:var(--accent);vertical-align:middle}
.legend{font-size:12px;color:var(--muted);margin:8px 0 16px;line-height:1.7}
a{color:var(--accent)}
</style></head><body>
<header><h1>🗺️ County Opportunity Scanner</h1>
<div class="sub">__COUNT__ U.S. counties ranked · Redfin market data through <b>__PERIOD__</b> + Census permits (2025) + population (2024) · all free sources</div>
</header>
<div class="wrap">
<div class="legend">
<b>MLI</b> = Market Liquidity Index (0–100): how fast a market absorbs &amp; sells — Z-scored from
Months of inventory 40% · Days on market 40% · Sale-to-list 20%. <i>This is the metric land flippers sell on.</i>
<br><b>Score</b> = Opportunity score (0–100), liquidity-first: <b>MLI 60%</b> · Population growth 15% · Construction intensity 10% · Affordable entry 15%.
Price/sales momentum is shown for context but earns <b>0 weight</b> — our backtest showed it doesn't predict outcomes.
<br><b>A where-to-look signal, not a buy signal.</b> Always run individual parcels through the Deal Analyzer + diligence checklist.
Currently uses <i>residential</i> data as a free proxy for land demand; run <code>backtest.py</code> to see how well the MLI predicts forward liquidity.
</div>
<div class="controls">
<input id="q" placeholder="Search county or metro..." oninput="render()" style="min-width:220px">
<select id="state" onchange="render()"><option value="">All states</option></select>
<select id="sort" onchange="render()">
<option value="score">Sort: Opportunity score</option>
<option value="mli">Sort: Market Liquidity Index</option>
<option value="popGrowth">Sort: Population growth</option>
<option value="permitsK">Sort: Construction intensity</option>
<option value="supply">Sort: Lowest inventory</option>
<option value="dom">Sort: Fastest selling</option>
<option value="saleToList">Sort: Sale-to-list ratio</option>
<option value="priceYoy">Sort: Price growth</option>
<option value="soldYoy">Sort: Sales growth</option>
<option value="price">Sort: Cheapest</option>
</select>
<span class="muted" id="count"></span>
</div>
<table><thead><tr>
<th onclick="sortBy('score')">Score</th><th onclick="sortBy('mli')">MLI</th><th onclick="sortBy('county')">County</th><th onclick="sortBy('state')">ST</th>
<th onclick="sortBy('supply')">Mo. supply</th><th onclick="sortBy('dom')">DOM</th><th onclick="sortBy('saleToList')">Sale/list</th>
<th onclick="sortBy('popGrowth')">Pop growth</th><th onclick="sortBy('permitsK')">Permits/1k</th>
<th onclick="sortBy('price')">Median $</th><th onclick="sortBy('priceYoy')">Price YoY</th><th onclick="sortBy('soldYoy')">Sales YoY</th>
<th onclick="sortBy('homes')">Homes sold</th>
</tr></thead><tbody id="rows"></tbody></table>
</div>
<script>
const DATA = __DATA__, STATES = __STATES__;
let sortKey="score", sortDir=-1;
const stEl=document.getElementById("state");
STATES.forEach(s=>{const o=document.createElement("option");o.value=s;o.textContent=s;stEl.appendChild(o);});
const pct=(v)=>v==null?'<span class="muted">—</span>':(v>=0?'<span class="pos">+':'<span class="neg">')+(v*100).toFixed(0)+'%</span>';
const money=(v)=>v==null?'<span class="muted">—</span>':'$'+Math.round(v).toLocaleString();
const num=(v,d=1)=>v==null?'<span class="muted">—</span>':(+v).toFixed(d);
const intc=(v)=>v==null?'<span class="muted">—</span>':Math.round(v).toLocaleString();
const scoreClass=(s)=>s>=66?'s-hi':s>=40?'s-mid':'s-lo';
const LOWER=['supply','dom','price'];
function sortBy(k){ if(sortKey===k)sortDir*=-1; else{sortKey=k;sortDir=LOWER.includes(k)?1:-1;} document.getElementById('sort').value=document.querySelector(`#sort option[value="${k}"]`)?k:'score'; render(); }
function render(){
  const q=document.getElementById('q').value.toLowerCase(), st=stEl.value, k=document.getElementById('sort').value;
  if(k!==sortKey){sortKey=k;sortDir=LOWER.includes(k)?1:-1;}
  let rows=DATA.filter(r=>(!st||r.state===st)&&(!q||(r.county+' '+(r.metro||'')).toLowerCase().includes(q)));
  rows.sort((a,b)=>{let x=a[sortKey],y=b[sortKey];if(x==null)x=sortDir>0?1e18:-1e18;if(y==null)y=sortDir>0?1e18:-1e18;if(typeof x==='string')return sortDir*x.localeCompare(y);return sortDir*(x-y);});
  document.getElementById('count').textContent=rows.length+' counties';
  document.getElementById('rows').innerHTML=rows.slice(0,500).map(r=>`<tr>
    <td class="score ${scoreClass(r.score)}">${r.score} <span class="bar" style="width:${Math.max(2,r.score/2)}px"></span></td>
    <td class="score ${scoreClass(r.mli)}">${r.mli}</td>
    <td>${r.county.replace(/, [A-Z]{2}$/,'')}</td><td>${r.state}</td>
    <td>${num(r.supply)}</td><td>${num(r.dom,0)}</td><td>${num(r.saleToList,3)}</td>
    <td>${pct(r.popGrowth)}</td><td>${num(r.permitsK)}</td>
    <td>${money(r.price)}</td><td>${pct(r.priceYoy)}</td><td>${pct(r.soldYoy)}</td>
    <td>${intc(r.homes)}</td></tr>`).join('');
  if(rows.length>500)document.getElementById('count').textContent+=' (showing top 500)';
}
render();
</script></body></html>"""


def main():
    refresh = "--refresh" in sys.argv
    records = build_records(refresh)
    if not records:
        log("No counties qualified."); sys.exit(1)
    write_csv(records)
    write_html(records)
    log(f"\nDone. Top market: {records[0]['county']} (score {records[0]['score']}).")
    log(f"Open: {OUT_HTML}")


if __name__ == "__main__":
    main()
