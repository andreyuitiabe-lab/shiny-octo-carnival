#!/usr/bin/env python3
"""
MLI calibration backtest  —  Land Flipping toolkit
==================================================
Answers: "Does the Market Liquidity Index predict the thing flippers actually
sell on — forward liquidity?"  (Not price appreciation: our v1/v2 test already
showed the score doesn't predict price, AND it shouldn't — flippers profit on
how FAST a market absorbs land, not on how much it appreciates.)

Method (walk-forward, out-of-sample):
  1. Go back N months. Using ONLY the Redfin data available then, compute each
     county's Market Liquidity Index (Z-scored: months of inventory 40%,
     days on market 40%, sale-to-list 20%) — identical to the live scanner.
  2. Measure what ACTUALLY happened next: the county's AVERAGE months-of-supply
     and days-on-market over the following N months (realized liquidity), plus
     forward price growth as a contrast metric.
  3. Check whether high-MLI counties really did stay liquid, via:
       - Spearman rank correlation (MLI vs. forward liquidity)
       - a decile calibration table (avg forward liquidity per MLI decile)

A high MLI should predict LOW forward months-of-supply and LOW forward DOM
(i.e. land you buy there will sell fast). We expect that to hold — liquidity is
persistent — while forward price stays uncorrelated (it mean-reverts). That
contrast is the whole thesis. Uses the SAME Redfin file the scanner downloaded.

NOTE: residential data is a free proxy for land liquidity. Past patterns don't
promise future results.

Usage:
  python3 backtest.py            # horizons 12 and 24 months
"""

import csv, gzip, os, sys
from bisect import bisect_left

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "data", "county_market_tracker.tsv000.gz")
OUT = os.path.join(HERE, "output", "backtest-report.html")

# Market Liquidity Index — identical to the live scanner (Z-scored).
# (key, weight, higher_is_better)
LIQ = [
    ("months_supply", 0.40, False),
    ("dom",           0.40, False),
    ("sale_to_list",  0.20, True),
]

COLS = {
    "price": "MEDIAN_SALE_PRICE", "months_supply": "MONTHS_OF_SUPPLY",
    "dom": "MEDIAN_DOM", "sale_to_list": "AVG_SALE_TO_LIST",
}


def log(m): print(m, flush=True)


def fnum(v):
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
        return None


def load_series():
    """{region: {period_end: {metric: value, 'price': value}}}"""
    if not os.path.exists(CACHE):
        log("ERROR: Redfin data not found. Run county_scanner.py first.")
        sys.exit(1)
    log("Loading Redfin history...")
    series = {}
    periods = set()
    with gzip.open(CACHE, "rt", encoding="utf-8", errors="replace") as fh:
        for row in csv.DictReader(fh, delimiter="\t"):
            if row.get("REGION_TYPE") != "county" or row.get("PROPERTY_TYPE") != "All Residential":
                continue
            region, p = row.get("REGION"), row.get("PERIOD_END")
            if not region or not p:
                continue
            rec = {k: fnum(row.get(c)) for k, c in COLS.items()}
            series.setdefault(region, {})[p] = rec
            periods.add(p)
    log(f"  {len(series)} counties, {len(periods)} months of history")
    return series, sorted(periods)


def percentile_ranker(values):
    n = len(values)
    def rank(v):
        if v is None or n == 0:
            return 0.5
        return bisect_left(values, v) / n
    return rank


def zscorer(values):
    """v -> winsorized z-score (mean 0, sd 1, clamped +/-3). None -> 0 (neutral)."""
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


def avg_ranks(xs):
    """Average ranks (ties shared), for Spearman."""
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    ranks = [0.0] * len(xs)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        r = (i + j) / 2.0 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = r
        i = j + 1
    return ranks


def pearson(a, b):
    n = len(a)
    ma, mb = sum(a) / n, sum(b) / n
    cov = sum((a[i]-ma)*(b[i]-mb) for i in range(n))
    va = sum((x-ma)**2 for x in a) ** 0.5
    vb = sum((x-mb)**2 for x in b) ** 0.5
    return cov / (va * vb) if va and vb else 0.0


def spearman(a, b):
    return pearson(avg_ranks(a), avg_ranks(b))


def run_horizon(series, periods, H):
    if len(periods) < H + 3:
        return None
    anchor = periods[-2]                 # skip the very latest (often incomplete)
    ai = periods.index(anchor)
    base = periods[ai - H]
    fwd_periods = periods[ai - H + 1: ai + 1]   # the H months AFTER base

    rows = []
    for region, hist in series.items():
        b = hist.get(base)
        if not b:
            continue
        if b.get("months_supply") is None and b.get("dom") is None:
            continue
        # realized forward liquidity: average MOI and DOM over the horizon
        mois = [hist[p]["months_supply"] for p in fwd_periods
                if p in hist and hist[p].get("months_supply") is not None]
        doms = [hist[p]["dom"] for p in fwd_periods
                if p in hist and hist[p].get("dom") is not None]
        if not mois or not doms:
            continue
        # forward price growth — the contrast metric (expected ~0 correlation)
        pb, o = b.get("price"), hist.get(anchor)
        po = o.get("price") if o else None
        fprice = (po - pb) / pb if (pb and po and pb > 0) else None
        rows.append({"region": region, "b": b,
                     "fmoi": sum(mois) / len(mois), "fdom": sum(doms) / len(doms),
                     "fprice": fprice})

    if len(rows) < 50:
        return None

    # MLI at base, Z-scored (identical to the live scanner)
    zers = {k: zscorer([r["b"][k] for r in rows]) for k, _w, _h in LIQ}
    for r in rows:
        comp = 0.0
        for key, w, higher in LIQ:
            z = zers[key](r["b"][key])
            comp += w * (z if higher else -z)
        r["mliRaw"] = comp
    mli_rank = percentile_ranker(sorted(r["mliRaw"] for r in rows))
    for r in rows:
        r["mli"] = mli_rank(r["mliRaw"]) * 100

    mli = [r["mli"] for r in rows]
    rho_moi = spearman(mli, [r["fmoi"] for r in rows])
    rho_dom = spearman(mli, [r["fdom"] for r in rows])
    price_rows = [r for r in rows if r["fprice"] is not None]
    rho_price = (spearman([r["mli"] for r in price_rows], [r["fprice"] for r in price_rows])
                 if len(price_rows) >= 50 else None)

    # decile calibration (by MLI)
    rows.sort(key=lambda r: r["mli"])
    n = len(rows)
    deciles = []
    for d in range(10):
        seg = rows[d*n//10:(d+1)*n//10]
        if seg:
            fp = [s["fprice"] for s in seg if s["fprice"] is not None]
            deciles.append({
                "d": d+1, "n": len(seg),
                "mli": sum(s["mli"] for s in seg)/len(seg),
                "fmoi": sum(s["fmoi"] for s in seg)/len(seg),
                "fdom": sum(s["fdom"] for s in seg)/len(seg),
                "fprice": (sum(fp)/len(fp)) if fp else None,
            })
    return {"H": H, "base": base, "anchor": anchor, "n": n,
            "rho_moi": rho_moi, "rho_dom": rho_dom, "rho_price": rho_price,
            "deciles": deciles}


def strength(rho):
    a = abs(rho)
    return ("strong" if a >= .4 else "moderate" if a >= .2
            else "weak" if a >= .1 else "negligible")


def print_result(r):
    if not r:
        return
    log(f"\n=== Horizon: {r['H']} months  ({r['base']} → {r['anchor']}, {r['n']} counties) ===")
    log("MLI vs. realized forward LIQUIDITY (the outcome flippers sell on):")
    log(f"  MLI vs forward months-of-supply: {r['rho_moi']:+.3f}  ({strength(r['rho_moi'])}; "
        f"want NEGATIVE = high MLI -> faster absorption)")
    log(f"  MLI vs forward days-on-market:   {r['rho_dom']:+.3f}  ({strength(r['rho_dom'])}; "
        f"want NEGATIVE = high MLI -> sells faster)")
    if r["rho_price"] is not None:
        log(f"  MLI vs forward price growth:     {r['rho_price']:+.3f}  ({strength(r['rho_price'])}; "
            f"contrast — expected ~0, price mean-reverts)")
    log(f"\n  MLI    AvgMLI   Fwd mo.supply   Fwd DOM   Fwd price")
    for d in r["deciles"]:
        fp = f"{d['fprice']*100:+5.1f}%" if d["fprice"] is not None else "   —  "
        log(f"   {d['d']:>2}    {d['mli']:>5.1f}     {d['fmoi']:>6.2f}        {d['fdom']:>5.0f}    {fp}   ({d['n']})")
    top, bot = r["deciles"][-1], r["deciles"][0]
    log(f"\n  Top MLI decile: {top['fmoi']:.2f} mo supply / {top['fdom']:.0f} DOM   "
        f"Bottom decile: {bot['fmoi']:.2f} mo supply / {bot['fdom']:.0f} DOM")
    log(f"  => Top-decile markets absorbed {bot['fmoi']-top['fmoi']:+.2f} months faster "
        f"and sold {bot['fdom']-top['fdom']:+.0f} days quicker.")


def write_html(results):
    # forward months-of-supply: lower = more liquid = better; bar length inverse
    def moi_bar(v):
        return max(2, min(260, int(260 * (1 - min(v, 12) / 12))))
    rows_html = ""
    for r in results:
        if not r:
            continue
        def drow(d):
            if d["fprice"] is None:
                pcell = "<td class='muted'>—</td>"
            else:
                cls = "pos" if d["fprice"] >= 0 else "neg"
                pcell = f"<td class='{cls}'>{d['fprice']*100:+.1f}%</td>"
            return (f"<tr><td>{d['d']}</td><td>{d['mli']:.1f}</td>"
                    f"<td><b>{d['fmoi']:.2f}</b> <span class='bar' style='width:{moi_bar(d['fmoi'])}px'></span></td>"
                    f"<td>{d['fdom']:.0f}</td>{pcell}<td>{d['n']}</td></tr>")
        drows = "".join(drow(d) for d in r["deciles"])
        top, bot = r["deciles"][-1], r["deciles"][0]
        pr = (f"<b class='{'pos' if r['rho_price']>=0 else 'neg'}'>{r['rho_price']:+.3f}</b>"
              if r["rho_price"] is not None else "—")
        rows_html += f"""
        <div class="card">
          <h2>{r['H']}-month horizon &nbsp;<span class="muted">{r['base']} → {r['anchor']} · {r['n']} counties</span></h2>
          <p>MLI → forward <b>months-of-supply</b>: <b class="{'pos' if r['rho_moi']<0 else 'neg'}">{r['rho_moi']:+.3f}</b>
             &nbsp;·&nbsp; → forward <b>DOM</b>: <b class="{'pos' if r['rho_dom']<0 else 'neg'}">{r['rho_dom']:+.3f}</b>
             &nbsp;·&nbsp; → forward <b>price</b> (contrast): {pr}
             <br><span class="muted">Negative liquidity correlations = high MLI predicts faster-selling markets (good).
             Price correlation near zero is expected — liquidity persists, appreciation mean-reverts.</span></p>
          <table><thead><tr><th>MLI decile</th><th>Avg MLI</th><th>Fwd months-supply (lower=better)</th><th>Fwd DOM</th><th>Fwd price</th><th>Counties</th></tr></thead>
          <tbody>{drows}</tbody></table>
          <p class="muted">Top-decile markets absorbed {bot['fmoi']-top['fmoi']:+.2f} months faster and sold
          {bot['fdom']-top['fdom']:+.0f} days quicker than bottom-decile markets.</p>
        </div>"""
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>MLI Calibration Backtest</title>
<style>body{{margin:0;background:#0f1419;color:#e6edf3;font:14px/1.6 -apple-system,sans-serif}}
.wrap{{max-width:860px;margin:0 auto;padding:24px}}h1{{font-size:20px}}.muted{{color:#8b9bab;font-weight:400}}
.card{{background:#1a2129;border:1px solid #2e3a46;border-radius:12px;padding:18px;margin:18px 0}}
h2{{font-size:15px;margin:0 0 6px}}table{{width:100%;border-collapse:collapse;margin-top:8px}}
th,td{{padding:6px 10px;text-align:left;border-bottom:1px solid #2e3a46;font-size:13px}}
th{{color:#8b9bab}}.bar{{display:inline-block;height:10px;background:#3fb950;border-radius:4px;vertical-align:middle}}
.pos{{color:#3fb950}}.neg{{color:#f85149}}</style></head><body><div class="wrap">
<h1>🎯 Market Liquidity Index — Calibration Backtest</h1>
<p class="muted">Walk-forward test: rank counties by MLI using only past data, then measure realized
<b>forward liquidity</b> (avg months-of-supply &amp; days-on-market) over the following months. If high-MLI
deciles show lower forward months-of-supply, the index predicts the outcome land flippers actually sell on.</p>
{rows_html}
<p class="muted">Residential data is a free proxy for land liquidity. A sanity check on the model — not a
guarantee of future results.</p>
</div></body></html>"""
    with open(OUT, "w") as f:
        f.write(html)
    log(f"\nWrote {OUT}")


def main():
    series, periods = load_series()
    results = []
    for H in (12, 24):
        r = run_horizon(series, periods, H)
        results.append(r)
        print_result(r)
    write_html(results)


if __name__ == "__main__":
    main()
