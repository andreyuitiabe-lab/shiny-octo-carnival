#!/usr/bin/env python3
"""
County Scores Report  —  Land Flipping toolkit
==============================================
Turns the County Scanner's raw 2,000-row table into a readable analytical report:
a curated shortlist of the best starter markets, the top rankings by Opportunity
Score and by Market Liquidity, and a state leaderboard.

Reads:  tools/output/county-opportunities.csv   (run county_scanner.py first)
Writes: tools/output/county-scores-report.html  (opens in your browser)

Usage:
  python3 county_report.py
"""

import csv, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(HERE, "output", "county-opportunities.csv")
OUT = os.path.join(HERE, "output", "county-scores-report.html")

# "Starter market" filter: the land-flip profile — affordable + actually growing
# (path of growth), ranked by Land-Flip Score.
AFFORDABLE_MAX = 400000   # median price ceiling (proxy for cheap entry)
MIN_GROWTH = 0.03         # >=3% population growth (4yr) — real in-migration
MIN_DEAL_FLOW = 20        # homes sold/mo — enough activity to comp
STARTER_COUNT = 15


def fnum(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def clean_county(name):
    return re.sub(r",\s*[A-Z]{2}\s*$", "", name or "").strip()


def load():
    if not os.path.exists(CSV):
        print("ERROR: county-opportunities.csv not found. Run county_scanner.py first.")
        sys.exit(1)
    rows = []
    for r in csv.DictReader(open(CSV)):
        rows.append({
            "score": fnum(r["score"]) or 0, "mli": fnum(r["mli"]) or 0,
            "hidden": fnum(r.get("hidden")) or 0, "comp": fnum(r.get("competition")) or 0,
            "county": clean_county(r["county"]), "state": r["state"],
            "legal": r.get("legal", "Clear"), "legalNote": r.get("legal_note", ""),
            "metro": clean_county(r.get("metro", "")),
            "homes": fnum(r["homes_sold"]) or 0, "pop": fnum(r["population"]),
            "popg": fnum(r["pop_growth_4yr"]), "permitsK": fnum(r["permits_per_1k"]),
            "price": fnum(r["median_price"]), "supply": fnum(r["months_supply"]),
            "dom": fnum(r["median_dom"]), "stl": fnum(r["sale_to_list"]),
            "period": r["period"],
        })
    return rows


def money(v):
    return "$" + format(int(v), ",") if v else "—"


def pct(v):
    if v is None:
        return "—"
    cls = "good" if v >= 0 else "bad"
    return f'<span class="{cls}">{v*100:+.0f}%</span>'


def num(v, d=1):
    return f"{v:.{d}f}" if v is not None else "—"


LEGAL_MAP = {
    "License req'd": ("lg-license", "⛔ License"),
    "Register": ("lg-register", "🟧 Register"),
    "Disclosure": ("lg-disclose", "🟨 Disclosure"),
    "Mktg limits": ("lg-marketing", "◐ Mktg limits"),
    "Clear": ("lg-clear", "✅ Clear"),
}


def legal_badge(r):
    cls, lbl = LEGAL_MAP.get(r["legal"], ("lg-clear", r["legal"]))
    note = (r.get("legalNote") or "").replace('"', "")
    return f'<span class="lg {cls}" title="{note}">{lbl}</span>'


def rank_rows(rows, key, label_html):
    out = []
    for i, r in enumerate(rows, 1):
        out.append(
            f"<tr><td class='n'>{i}</td><td class='n score {scls(r[key])}'>{num(r[key])}</td>"
            f"<td>{r['county']}</td><td>{r['state']}</td><td>{legal_badge(r)}</td><td class='muted'>{r['metro']}</td>"
            f"<td class='n'>{money(r['price'])}</td><td class='n'>{num(r['supply'])}</td>"
            f"<td class='n'>{num(r['dom'],0)}</td><td class='n'>{num(r['stl'],3)}</td>"
            f"<td class='n'>{pct(r['popg'])}</td><td class='n'>{int(r['homes']):,}</td></tr>")
    return "".join(out)


def scls(s):
    return "s-hi" if s >= 66 else "s-mid" if s >= 40 else "s-lo"


def build():
    rows = load()
    if not rows:
        print("No rows."); sys.exit(1)
    period = rows[0]["period"]
    n = len(rows)
    by_score = sorted(rows, key=lambda r: r["score"], reverse=True)
    by_mli = sorted(rows, key=lambda r: r["mli"], reverse=True)

    # Starter markets: the land-flip profile — cheap + actually growing + some
    # activity — ranked by Land-Flip Score.
    starters = [r for r in rows
                if r["price"] and r["price"] <= AFFORDABLE_MAX
                and r["popg"] is not None and r["popg"] >= MIN_GROWTH
                and r["homes"] >= MIN_DEAL_FLOW]
    starters = sorted(starters, key=lambda r: r["score"], reverse=True)[:STARTER_COUNT]

    # Under-the-radar picks: real demand the crowd is missing — strong Land-Flip,
    # LOW competition, with an exit (builders), affordable, and legally workable.
    radar = [r for r in rows
             if r["score"] >= 70 and r["comp"] <= 40
             and r["price"] and r["price"] <= AFFORDABLE_MAX
             and r["popg"] is not None and r["popg"] >= MIN_GROWTH
             and (r["permitsK"] or 0) >= 3                     # exit: active builders
             and r["legal"] in ("Clear", "Mktg limits")]      # avoid license/register states
    radar = sorted(radar, key=lambda r: r["hidden"], reverse=True)[:STARTER_COUNT]

    # State leaderboard: avg score, # counties, # in national top 100.
    top100 = set(id(r) for r in by_score[:100])
    states = {}
    for r in rows:
        s = states.setdefault(r["state"], {"n": 0, "sum": 0.0, "top": 0, "best": None})
        s["n"] += 1; s["sum"] += r["score"]
        if id(r) in top100:
            s["top"] += 1
        if s["best"] is None or r["score"] > s["best"]["score"]:
            s["best"] = r
    state_rows = sorted(states.items(), key=lambda kv: (kv[1]["top"], kv[1]["sum"] / kv[1]["n"]), reverse=True)[:15]

    # ---- starter cards ----
    starter_html = ""
    for i, r in enumerate(starters, 1):
        reasons = []
        if r["popg"] is not None and r["popg"] >= 0.10: reasons.append("booming growth")
        elif r["popg"] is not None and r["popg"] >= 0.05: reasons.append("strong growth")
        if r["permitsK"] is not None and r["permitsK"] >= 8: reasons.append("very active builders")
        elif r["permitsK"] is not None and r["permitsK"] >= 4: reasons.append("active builders")
        if r["price"] and r["price"] <= 300000: reasons.append("cheap entry")
        why = ", ".join(reasons) or "path-of-growth profile"
        pg = f"+{r['popg']*100:.0f}%" if r["popg"] is not None else "—"
        pk = num(r["permitsK"]) if r["permitsK"] is not None else "—"
        starter_html += f"""
        <div class="card">
          <div class="rank">#{i}</div>
          <div class="body">
            <div class="title">{r['county']}, {r['state']} {legal_badge(r)} <span class="muted">· {r['metro']}</span></div>
            <div class="metrics">
              <span><b class="{scls(r['score'])}">{num(r['score'])}</b> Land-Flip</span>
              <span><b>{pg}</b> growth</span>
              <span><b>{pk}</b> permits/1k</span>
              <span><b>{money(r['price'])}</b> median</span>
              <span><b class="{scls(r['mli'])}">{num(r['mli'])}</b> MLI</span>
            </div>
            <div class="why">Why: {why}</div>
          </div>
        </div>"""

    # ---- under-the-radar cards ----
    radar_html = ""
    for i, r in enumerate(radar, 1):
        pg = f"+{r['popg']*100:.0f}%" if r["popg"] is not None else "—"
        pk = num(r["permitsK"]) if r["permitsK"] is not None else "—"
        ring = f"near {r['metro']}" if r["metro"] else "rural grower"
        radar_html += f"""
        <div class="card">
          <div class="rank" style="color:var(--warn)">#{i}</div>
          <div class="body">
            <div class="title">{r['county']}, {r['state']} {legal_badge(r)} <span class="muted">· {ring}</span></div>
            <div class="metrics">
              <span><b class="warn">{num(r['hidden'])}</b> Hidden</span>
              <span><b>{num(r['comp'])}</b>/100 competition</span>
              <span><b class="{scls(r['score'])}">{num(r['score'])}</b> Land-Flip</span>
              <span><b>{pg}</b> growth</span>
              <span><b>{pk}</b> permits/1k</span>
              <span><b>{money(r['price'])}</b> median</span>
            </div>
            <div class="why">Why: real demand, low competition ({num(r['comp'])}/100) — the crowd is on the big metros</div>
          </div>
        </div>"""

    state_html = ""
    for st, s in state_rows:
        b = s["best"]
        state_html += (f"<tr><td>{st}</td><td class='n'>{s['top']}</td>"
                       f"<td class='n'>{s['sum']/s['n']:.1f}</td><td class='n'>{s['n']}</td>"
                       f"<td>{b['county']} <span class='muted'>({num(b['score'])})</span></td></tr>")

    cols = ("<th class='n'>#</th><th class='n'>{m}</th><th>County</th><th>ST</th><th>Legal</th><th>Metro</th>"
            "<th class='n'>Median $</th><th class='n'>Mo sup</th><th class='n'>DOM</th>"
            "<th class='n'>Sale/list</th><th class='n'>Pop gr</th><th class='n'>Sold/mo</th>")

    html = HTML.replace("__PERIOD__", period).replace("__N__", f"{n:,}") \
        .replace("__NSTART__", str(len(starters))) \
        .replace("__NRADAR__", str(len(radar))) \
        .replace("__STARTERS__", starter_html) \
        .replace("__RADAR__", radar_html) \
        .replace("__SCORE_COLS__", cols.format(m="Score")) \
        .replace("__SCORE_ROWS__", rank_rows(by_score[:25], "score", "Score")) \
        .replace("__MLI_COLS__", cols.format(m="MLI")) \
        .replace("__MLI_ROWS__", rank_rows(by_mli[:25], "mli", "MLI")) \
        .replace("__STATE_ROWS__", state_html)
    with open(OUT, "w") as f:
        f.write(html)
    print(f"Wrote {OUT}")
    if sys.platform == "darwin":
        os.system(f'open "{OUT}"')


HTML = r"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>County Scores Report</title><style>
:root{--bg:#0f1419;--panel:#1a2129;--panel2:#222c36;--line:#2e3a46;--text:#e6edf3;
--muted:#8b9bab;--accent:#58a6ff;--good:#3fb950;--warn:#d29922;--bad:#f85149}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);
font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
header{padding:26px 24px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#161d24,#0f1419)}
header h1{margin:0;font-size:23px}header .sub{color:var(--muted);font-size:13.5px;margin-top:6px}
.wrap{max-width:1080px;margin:0 auto;padding:14px 24px 90px}
h2{font-size:19px;margin:34px 0 4px;padding-top:12px;border-top:1px solid var(--line)}
h2 .tag{color:var(--accent);font-size:12.5px;font-weight:600;display:block;text-transform:uppercase;letter-spacing:.6px}
p.intro{color:var(--muted);font-size:14px;margin:6px 0 14px}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:760px){.cards{grid-template-columns:1fr}}
.card{display:flex;gap:12px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.card .rank{font-size:20px;font-weight:800;color:var(--accent);min-width:34px}
.card .title{font-weight:700;font-size:14.5px}
.card .metrics{display:flex;flex-wrap:wrap;gap:10px;margin:7px 0;font-size:12.5px;color:var(--muted)}
.card .metrics b{color:var(--text)}
.card .why{font-size:12px;color:var(--warn)}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12.5px}
th,td{text-align:left;padding:6px 9px;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--muted);font-weight:600;background:#161d24}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.score{font-weight:700}.s-hi{color:var(--good)}.s-mid{color:var(--warn)}.s-lo{color:var(--muted)}
.good{color:var(--good)}.bad{color:var(--bad)}.warn{color:var(--warn)}.muted{color:var(--muted)}
.lg{font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:10px;white-space:nowrap}
.lg-license{background:rgba(248,81,73,.16);color:var(--bad)}
.lg-register{background:rgba(210,153,34,.18);color:var(--warn)}
.lg-disclose{background:rgba(210,153,34,.12);color:var(--warn)}
.lg-marketing{background:rgba(139,155,171,.16);color:var(--muted)}
.lg-clear{background:rgba(63,185,80,.14);color:var(--good)}
.callout{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--accent);
border-radius:8px;padding:11px 15px;margin:14px 0;font-size:13.5px}
.foot{margin-top:38px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px}
a{color:var(--accent)}
</style></head><body>
<header><h1>🗺️ County Scores Report</h1>
<div class="sub">__N__ U.S. counties scored · Redfin data through <b>__PERIOD__</b> + Census · all free sources</div>
</header>
<div class="wrap">

<div class="callout">
<b>Land-Flip Score</b> (headline) = where the land-flip spread lives: <b>Population growth 40% + Builder/construction
activity 35% + Cheap entry 25%</b>. Land flipping profits on the <i>path of growth</i> (cheap land + active builders +
in-migration), not on existing homes reselling fast. <b>MLI</b> = residential resale liquidity, kept as a secondary
"is the market frozen or transacting?" check — a high-MLI / low-growth metro is a poor land flip. A <b>where-to-look</b>
signal, not a buy signal. <a href="../../methodology.html">Full methodology →</a>
<br><br><b>Legal</b> badges show each state's wholesaling status (mid-2026 snapshot, <b>not legal advice</b>):
<span class="lg lg-license">⛔ License</span> license effectively required ·
<span class="lg lg-register">🟧 Register</span> register with the state ·
<span class="lg lg-disclose">🟨 Disclosure</span> written seller disclosure ·
<span class="lg lg-marketing">◐ Mktg limits</span> can't advertise the property (private assignment OK) ·
<span class="lg lg-clear">✅ Clear</span>. Verify with a local attorney before operating.</div>

<h2><span class="tag">Start here</span>Best starter markets &nbsp;<span class="muted" style="font-size:13px;font-weight:400">__NSTART__ shortlisted: the land-flip profile — cheap (≤$400k) + growing (≥3%) + active</span></h2>
<p class="intro">Top Land-Flip Scores filtered to the path-of-growth profile: cheap land + population growth + active builders — where the 3–5× spread actually lives. Check the legal badge before you commit to a state.</p>
<div class="cards">__STARTERS__</div>

<h2><span class="tag" style="color:#d29922">Escape the obvious</span>Under-the-radar picks &nbsp;<span class="muted" style="font-size:13px;font-weight:400">__NRADAR__ found: real demand + LOW competition + an exit</span></h2>
<p class="intro">The whole list above is where <i>everyone</i> is mailing. These are counties with strong Land-Flip demand but <b>low competition</b>
(competition ≤ 40/100, proxied by market size) — the "next ring out" from growing metros + overlooked rural growers, where you're not fighting hedge funds for the same parcels. Each still has active builders (an exit) and is legally workable.</p>
<div class="cards">__RADAR__</div>

<h2><span class="tag">Ranking</span>Top 25 by Land-Flip Score</h2>
<p class="intro">The headline ranking — cheap + growing + builders. The land-flip markets (Sun Belt exurbs, Texas, Florida, Carolinas, Arizona).</p>
<table><thead><tr>__SCORE_COLS__</tr></thead><tbody>__SCORE_ROWS__</tbody></table>

<h2><span class="tag">Secondary</span>Top 25 by Market Liquidity (MLI) — resale speed</h2>
<p class="intro">The <i>secondary</i> lens: how fast existing homes resell. NOT the land-flip signal — many of these are mature metros with little cheap land. Use it only to check a market isn't frozen. Note how different this list is from the one above.</p>
<table><thead><tr>__MLI_COLS__</tr></thead><tbody>__MLI_ROWS__</tbody></table>

<h2><span class="tag">Geography</span>State leaderboard</h2>
<p class="intro">Ranked by how many of the national top-100 (by Land-Flip Score) counties each state holds, then by average score.</p>
<table><thead><tr><th>State</th><th class="n">In top 100</th><th class="n">Avg score</th><th class="n">Counties</th><th>Best county</th></tr></thead>
<tbody>__STATE_ROWS__</tbody></table>

<div class="foot">
Generated from <code>county-opportunities.csv</code>. Open <a href="county-opportunities.html">the full interactive table</a>
to sort/filter all __N__ counties · <a href="../../methodology.html">methodology</a> · <a href="../../PROJECT-LOG.md">project log</a>.
</div>
</div></body></html>"""


if __name__ == "__main__":
    build()
