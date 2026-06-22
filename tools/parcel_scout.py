#!/usr/bin/env python3
"""
Parcel Scout  —  Land Flipping toolkit
======================================
Automatically pulls every VACANT-LAND parcel in a target county, scores each one
as a mailing lead, and auto-runs the free due-diligence kill-gates (flood /
wetland / slope) on the most promising ones. This is the free, per-county version
of Modules 3–4 of `deep research.md` (data ingestion + remote due diligence).

What it does WITHOUT any paid API or key:
  1. Pulls vacant parcels (owner, mailing address, acreage, zoning class,
     assessed value, utilities) from the free **NYS statewide parcel** ArcGIS
     service — covers many top-MLI NY counties (Genesee, Wayne, Livingston, …).
  2. Computes lead signals: absentee owner (mails from out of town / state =
     motivation), acreage tier, and assessed $/acre (cheap entry).
  3. Ranks all parcels, then auto-runs FREE diligence on the top N:
        - FEMA National Flood Hazard Layer  (flood zone)
        - USFWS National Wetlands Inventory  (wetland)
        - USGS 3DEP elevation                (slope estimate)
  4. Writes a sortable HTML report + CSV. Promising, gate-passing parcels are
     ready to drop into the Deal Analyzer (you still add sold comps by hand —
     no free nationwide land-comp source exists).

All free. No API key. Runs on the Python that ships with macOS.

Output:
  tools/output/parcels-<county>.html   <- open this (sortable)
  tools/output/parcels-<county>.csv

Usage:
  python3 parcel_scout.py                       # Genesee County, top 30 diligence
  python3 parcel_scout.py --county Wayne        # a different NY county (must be in the dataset)
  python3 parcel_scout.py --min-acres 2 --top 40
  python3 parcel_scout.py --no-diligence        # fast: skip the flood/wetland/slope calls

NOTE: lead score is a *prioritization* heuristic (who to look at first), NOT a
buy signal. Always run a real parcel through the Deal Analyzer + diligence
checklist before making an offer.
"""

import csv, json, math, os, sys, time, urllib.parse, urllib.request

# --- Config ----------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, "output")

PARCELS_URL = ("https://gisservices.its.ny.gov/arcgis/rest/services/"
               "NYS_Tax_Parcels_Public/FeatureServer/1/query")
FEMA_URL = ("https://hazards.fema.gov/gis/nfhl/rest/services/public/"
            "NFHL/MapServer/28/query")
WETLAND_URL = ("https://www.fws.gov/wetlandsmapservice/rest/services/"
               "Wetlands/MapServer/0/query")
USGS_URL = "https://epqs.nationalmap.gov/v1/json"

# Counties currently in the free NYS public parcel dataset (verified present).
NY_COUNTIES = {
    "Albany","Bronx","Broome","Cayuga","Chautauqua","Cortland","Erie","Genesee",
    "Greene","Hamilton","Kings","Lewis","Livingston","Montgomery","NewYork","Oneida",
    "Onondaga","Ontario","Orange","Oswego","Otsego","Putnam","Queens","Rensselaer",
    "Richmond","Rockland","Schuyler","StLawrence","Steuben","Suffolk","Sullivan",
    "Tioga","Tompkins","Ulster","Warren","Wayne","Westchester","Wyoming",
}

# Acreage decay tiers (same as the Deal Analyzer).
TIERS = [(5, 1, "1-5ac"), (10, 2, "5-10ac"), (20, 3, "10-20ac"), (1e12, 4, "20+ac")]

# Corporate / institutional owner tokens — rarely motivated individual sellers
# (cell towers, ag LLCs, banks, churches, governments), so we down-weight them.
CORP_TOKENS = ("LLC", "INC", "CORP", "COMPANY", "LP", "LTD", "TOWER", "ASSOC",
               "PARTNERS", "HOLDINGS", "ENTERPRISES", "REALTY", "PROPERTIES",
               "BANK", "CHURCH", "AUTHORITY", "MINISTRIES", "FUND", "TRUSTEES")
CORP_PHRASES = ("TOWN OF", "CITY OF", "COUNTY OF", "STATE OF", "VILLAGE OF")


def is_corporate(name):
    n = " ".join((name or "").upper().replace(",", " ").replace(".", " ").split())
    tokens = set(n.split())
    return any(t in tokens for t in CORP_TOKENS) or any(ph in n for ph in CORP_PHRASES)

# Special-flood-hazard zones (development-restricted). 'X' = minimal risk.
FLOOD_BAD = {"A", "AE", "AH", "AO", "AR", "A99", "V", "VE", "D"}


def log(m): print(m, flush=True)


# --- Resilient HTTP --------------------------------------------------------
def get_json(url, params, timeout=30, tries=2):
    """GET + parse JSON. Returns None on any failure (never raises)."""
    full = url + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            req = urllib.request.Request(full, headers={"User-Agent": "parcel-scout/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except Exception:
            if i + 1 < tries:
                time.sleep(1.0)
    return None


# --- Stage 1: pull vacant parcels ------------------------------------------
PULL_FIELDS = ("OBJECTID,PRINT_KEY,PROP_CLASS,ACRES,PARCEL_ADDR,MUNI_NAME,LOC_ZIP,"
               "LAND_AV,FULL_MARKET_VAL,PRIMARY_OWNER,ADD_OWNER,OWNER_TYPE,"
               "MAIL_ADDR,PO_BOX,MAIL_CITY,MAIL_STATE,MAIL_ZIP,WATER_DESC,SEWER_DESC,UTILITIES_DESC")


def fetch_parcels(county, min_acres):
    where = f"COUNTY_NAME='{county}' AND PROP_CLASS LIKE '3%' AND ACRES>={min_acres}"
    out, offset, page = [], 0, 2000
    while True:
        d = get_json(PARCELS_URL, {
            "where": where, "outFields": PULL_FIELDS, "returnGeometry": "false",
            "orderByFields": "OBJECTID", "resultOffset": offset,
            "resultRecordCount": page, "f": "json",
        }, timeout=60)
        if not d or "features" not in d:
            if not out:
                log("  ERROR: parcel service did not respond / returned no data.")
            break
        feats = [f["attributes"] for f in d["features"]]
        out += feats
        log(f"  pulled {len(out)} parcels...")
        if len(d["features"]) < page:
            break
        offset += page
    return out


def tier_of(a):
    for mx, t, lbl in TIERS:
        if a < mx:
            return t, lbl
    return 4, "20+ac"


def percentile_ranker(values):
    from bisect import bisect_left
    n = len(values)
    def rank(v):
        if v is None or n == 0:
            return 0.5
        return bisect_left(values, v) / n
    return rank


# --- Stage 2: lead signals + ranking ---------------------------------------
def enrich_and_rank(parcels):
    for p in parcels:
        a = p.get("ACRES") or 0
        fmv = p.get("FULL_MARKET_VAL") or 0
        p["_acres"] = a
        p["_tier"], p["_tierlbl"] = tier_of(a)
        p["_fmv_per_acre"] = (fmv / a) if (a > 0 and fmv > 0) else None
        muni = (p.get("MUNI_NAME") or "").strip().upper()
        mcity = (p.get("MAIL_CITY") or "").strip().upper()
        mstate = (p.get("MAIL_STATE") or "").strip().upper()
        p["_out_of_state"] = bool(mstate and mstate != "NY")
        p["_out_of_town"] = bool(mcity and muni and mcity != muni) and not p["_out_of_state"]
        p["_corp"] = is_corporate(p.get("PRIMARY_OWNER"))

    vals = sorted(p["_fmv_per_acre"] for p in parcels if p["_fmv_per_acre"])
    rank = percentile_ranker(vals)
    for p in parcels:
        cheap = (1 - rank(p["_fmv_per_acre"])) if p["_fmv_per_acre"] else 0.5
        ab = 1.0 if p["_out_of_state"] else 0.6 if p["_out_of_town"] else 0.0
        # an absentee corporation isn't a motivated individual seller — discount it
        if p["_corp"]:
            ab *= 0.3
        a = p["_acres"]
        size = 1.0 if 2 <= a <= 20 else 0.5 if a > 20 else 0.3
        # prioritization blend: motivation 40% + sellable size 25% + cheap entry 35%
        p["_lead"] = round(100 * (0.40 * ab + 0.25 * size + 0.35 * cheap), 1)
    parcels.sort(key=lambda x: x["_lead"], reverse=True)
    return parcels


# --- Stage 3: free auto-diligence on the top N -----------------------------
def centroid_lonlat(objectid):
    d = get_json(PARCELS_URL, {
        "where": f"OBJECTID={objectid}", "returnCentroid": "true",
        "returnGeometry": "false", "outSR": "4326", "outFields": "OBJECTID", "f": "json",
    })
    try:
        c = d["features"][0]["centroid"]
        return c["x"], c["y"]
    except Exception:
        return None


def flood_zone(lon, lat):
    d = get_json(FEMA_URL, {
        "geometry": f"{lon},{lat}", "geometryType": "esriGeometryPoint", "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects", "outFields": "FLD_ZONE",
        "returnGeometry": "false", "f": "json",
    })
    if d is None:
        return "?"
    feats = d.get("features", [])
    if not feats:
        return "X"  # not in a mapped special-flood-hazard area
    zones = sorted({f["attributes"].get("FLD_ZONE") for f in feats if f["attributes"].get("FLD_ZONE")})
    return ",".join(zones) if zones else "X"


def wetland(lon, lat):
    d = get_json(WETLAND_URL, {
        "geometry": f"{lon},{lat}", "geometryType": "esriGeometryPoint", "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects", "outFields": "WETLAND_TYPE",
        "returnGeometry": "false", "f": "json",
    })
    if d is None:
        return "?"
    feats = d.get("features", [])
    if not feats:
        return "none"
    return feats[0]["attributes"].get("WETLAND_TYPE") or "wetland"


def elev_m(lon, lat):
    d = get_json(USGS_URL, {"x": lon, "y": lat, "units": "Meters", "wkid": "4326"}, timeout=20)
    try:
        return float(d["value"])
    except Exception:
        return None


def slope_deg(lon, lat):
    """Estimate slope from a 4-point cross (~110 m apart) around the centroid."""
    dlat = 0.0005
    dlon = 0.0005 / max(0.2, math.cos(math.radians(lat)))
    n, s = elev_m(lon, lat + dlat), elev_m(lon, lat - dlat)
    e, w = elev_m(lon + dlon, lat), elev_m(lon - dlon, lat)
    if None in (n, s, e, w):
        return None
    run = 110.0
    grad = math.sqrt(((e - w) / run) ** 2 + ((n - s) / run) ** 2)
    return round(math.degrees(math.atan(grad)), 1)


def run_diligence(parcels, n):
    todo = parcels[:n]
    log(f"Auto-diligence on top {len(todo)} parcels (free FEMA + USFWS + USGS)...")
    for i, p in enumerate(todo, 1):
        cen = centroid_lonlat(p["OBJECTID"])
        if not cen:
            p["_dilig"] = {"flood": "?", "wetland": "?", "slope": None}
            continue
        lon, lat = cen
        p["_lon"], p["_lat"] = lon, lat
        p["_dilig"] = {
            "flood": flood_zone(lon, lat),
            "wetland": wetland(lon, lat),
            "slope": slope_deg(lon, lat),
        }
        if i % 5 == 0:
            log(f"  diligence {i}/{len(todo)}")
        time.sleep(0.15)
    return parcels


def gate_verdict(d):
    """Roll the three checks into PASS / CAUTION / KILL / ? for display."""
    if not d:
        return "—"
    flags = []
    fl = d.get("flood")
    if fl and fl != "?" and any(z in FLOOD_BAD for z in fl.split(",")):
        flags.append("flood")
    wt = d.get("wetland")
    if wt and wt not in ("none", "?"):
        flags.append("wetland")
    sl = d.get("slope")
    if sl is not None and sl > 15:
        flags.append("steep")
    if flags:
        return "KILL:" + "+".join(flags)
    if "?" in (d.get("flood"), d.get("wetland")) or d.get("slope") is None:
        return "CHECK"
    return "PASS"


# --- Output ----------------------------------------------------------------
def write_csv(parcels, county):
    path = os.path.join(OUTDIR, f"parcels-{county}.csv")
    cols = ["lead", "gate", "owner", "co_owner", "owner_type", "absentee",
            "mail_street", "mail_pobox", "mail_city", "mail_state", "mail_zip",
            "acres", "tier", "class", "address", "muni", "fmv", "fmv_per_acre",
            "water", "sewer", "flood", "wetland", "slope_deg", "lat", "lon", "print_key"]
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for p in parcels:
            d = p.get("_dilig", {})
            ab = "out-of-state" if p["_out_of_state"] else "out-of-town" if p["_out_of_town"] else "local"
            w.writerow([
                p["_lead"], gate_verdict(d), p.get("PRIMARY_OWNER"), p.get("ADD_OWNER"),
                "corp" if p["_corp"] else "individual", ab,
                p.get("MAIL_ADDR"), p.get("PO_BOX"), p.get("MAIL_CITY"),
                p.get("MAIL_STATE"), p.get("MAIL_ZIP"),
                round(p["_acres"], 2), p["_tierlbl"], p.get("PROP_CLASS"),
                p.get("PARCEL_ADDR"), p.get("MUNI_NAME"),
                int(p.get("FULL_MARKET_VAL") or 0),
                round(p["_fmv_per_acre"]) if p["_fmv_per_acre"] else "",
                p.get("WATER_DESC"), p.get("SEWER_DESC"),
                d.get("flood", ""), d.get("wetland", ""),
                d.get("slope", "") if d else "",
                round(p.get("_lat"), 6) if p.get("_lat") else "",
                round(p.get("_lon"), 6) if p.get("_lon") else "",
                p.get("PRINT_KEY"),
            ])
    log(f"Wrote {path}")
    return path


def write_html(parcels, county, n_dilig):
    path = os.path.join(OUTDIR, f"parcels-{county}.html")
    absentee = sum(1 for p in parcels if p["_out_of_state"] or p["_out_of_town"])
    data = []
    for p in parcels:
        d = p.get("_dilig", {})
        data.append({
            "lead": p["_lead"], "gate": gate_verdict(d),
            "owner": p.get("PRIMARY_OWNER") or "", "corp": 1 if p["_corp"] else 0,
            "abs": "OOS" if p["_out_of_state"] else "OOT" if p["_out_of_town"] else "",
            "acres": round(p["_acres"], 2), "tier": p["_tier"], "tierlbl": p["_tierlbl"],
            "cls": p.get("PROP_CLASS") or "", "addr": p.get("PARCEL_ADDR") or "",
            "muni": p.get("MUNI_NAME") or "",
            "fmv": int(p.get("FULL_MARKET_VAL") or 0),
            "ppa": round(p["_fmv_per_acre"]) if p["_fmv_per_acre"] else None,
            "mailcity": p.get("MAIL_CITY") or "", "mailstate": p.get("MAIL_STATE") or "",
            "water": p.get("WATER_DESC") or "", "flood": d.get("flood", ""),
            "wet": d.get("wetland", ""), "slope": d.get("slope") if d else None,
            "lat": p.get("_lat"), "lon": p.get("_lon"), "key": p.get("PRINT_KEY") or "",
        })
    html = (HTML_TEMPLATE
            .replace("__COUNTY__", county)
            .replace("__COUNT__", f"{len(parcels):,}")
            .replace("__ABSENTEE__", f"{absentee:,}")
            .replace("__NDILIG__", str(n_dilig))
            .replace("__DATA__", json.dumps(data)))
    with open(path, "w") as f:
        f.write(html)
    log(f"Wrote {path}")
    return path


HTML_TEMPLATE = r"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Parcel Scout — __COUNTY__</title><style>
:root{--bg:#0f1419;--panel:#1a2129;--line:#2e3a46;--text:#e6edf3;--muted:#8b9bab;--accent:#58a6ff;--good:#3fb950;--warn:#d29922;--bad:#f85149}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
header{padding:18px 24px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#161d24,#0f1419)}
header h1{margin:0;font-size:20px}header .sub{color:var(--muted);font-size:13px;margin-top:4px}
.wrap{max-width:1500px;margin:0 auto;padding:18px 24px 80px}
.controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
input,select{padding:8px 11px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:8px;font-size:14px}
.legend{font-size:12px;color:var(--muted);margin:6px 0 14px;line-height:1.7}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{padding:6px 8px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
th.l,td.l{text-align:left}
th{position:sticky;top:0;background:#161d24;cursor:pointer;user-select:none;color:var(--muted);font-weight:600}
th:hover{color:var(--text)}tr:hover td{background:#161d24}
.lead{font-weight:700}.s-hi{color:var(--good)}.s-mid{color:var(--warn)}.s-lo{color:var(--muted)}
.tag{font-size:10.5px;padding:1px 6px;border-radius:10px;font-weight:700}
.oos{background:rgba(248,81,73,.16);color:var(--bad)}.oot{background:rgba(210,153,34,.16);color:var(--warn)}
.g-pass{color:var(--good);font-weight:700}.g-kill{color:var(--bad);font-weight:700}.g-check{color:var(--muted)}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.muted{color:var(--muted)}
</style></head><body>
<header><h1>🛰️ Parcel Scout — __COUNTY__ County, NY</h1>
<div class="sub">__COUNT__ vacant-land parcels · __ABSENTEE__ absentee-owned · free auto-diligence on top __NDILIG__ · NYS parcel data + FEMA/USFWS/USGS</div>
</header>
<div class="wrap">
<div class="legend">
<b>Lead</b> = mailing-priority score (motivation 40% + sellable size 25% + cheap entry 35%) — <i>who to look at first, not a buy signal.</i>
<b>Absentee</b>: <span class="tag oos">OOS</span> owner mails from out of state · <span class="tag oot">OOT</span> out of town = likely motivated.
<b>Gate</b> (top __NDILIG__ only): <span class="g-pass">PASS</span> / <span class="g-kill">KILL</span> (flood/wetland/steep) / <span class="g-check">CHECK</span>.
Assessed value is a free proxy — confirm real value with sold comps in the Deal Analyzer before offering.
<br><b>⚠️ NY wholesaling:</b> market the <i>assignable contract interest</i>, not the property itself (no public ads of
property you don't own). Use "and/or assigns". <b>Not legal advice</b> — verify with a local attorney.
</div>
<div class="controls">
<input id="q" placeholder="Search owner / address / town..." oninput="render()" style="min-width:240px">
<select id="abs" onchange="render()"><option value="">All owners</option><option value="OOS">Out of state</option><option value="OOT">Out of town</option><option value="any">Any absentee</option><option value="indiv">Individuals only</option></select>
<select id="gate" onchange="render()"><option value="">All gates</option><option value="PASS">PASS only</option><option value="KILL">exclude KILL</option></select>
<select id="sort" onchange="render()">
<option value="lead">Sort: Lead score</option><option value="acres">Sort: Acreage</option>
<option value="fmv">Sort: Assessed value</option><option value="ppa">Sort: $/acre (cheapest)</option>
</select>
<span class="muted" id="count"></span>
</div>
<table><thead><tr>
<th onclick="sortBy('lead')">Lead</th><th onclick="sortBy('gate')">Gate</th>
<th class="l" onclick="sortBy('owner')">Owner</th><th>Absentee</th>
<th onclick="sortBy('acres')">Acres</th><th>Tier</th><th>Cls</th>
<th class="l" onclick="sortBy('addr')">Address</th><th class="l">Town</th>
<th onclick="sortBy('fmv')">Assessed $</th><th onclick="sortBy('ppa')">$/acre</th>
<th class="l">Mails from</th><th class="l">Water</th>
<th>Flood</th><th>Wetland</th><th>Slope°</th><th>Map</th>
</tr></thead><tbody id="rows"></tbody></table>
</div>
<script>
const DATA=__DATA__;
let sortKey="lead",sortDir=-1;
const LOWER=["ppa"];
const money=v=>v==null?'<span class="muted">—</span>':'$'+Math.round(v).toLocaleString();
const leadClass=s=>s>=66?'s-hi':s>=40?'s-mid':'s-lo';
function gateCell(g){if(!g||g==='—')return '<span class="muted">—</span>';if(g.startsWith('PASS'))return '<span class="g-pass">PASS</span>';if(g.startsWith('KILL'))return '<span class="g-kill">'+g+'</span>';return '<span class="g-check">'+g+'</span>';}
function absCell(a){return a==='OOS'?'<span class="tag oos">OOS</span>':a==='OOT'?'<span class="tag oot">OOT</span>':'<span class="muted">local</span>';}
function sortBy(k){if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=LOWER.includes(k)?1:-1;}document.getElementById('sort').value=document.querySelector(`#sort option[value="${k}"]`)?k:'lead';render();}
function render(){
  const q=document.getElementById('q').value.toLowerCase();
  const af=document.getElementById('abs').value, gf=document.getElementById('gate').value;
  const k=document.getElementById('sort').value; if(k!==sortKey){sortKey=k;sortDir=LOWER.includes(k)?1:-1;}
  let rows=DATA.filter(r=>{
    if(q && !((r.owner+' '+r.addr+' '+r.muni).toLowerCase().includes(q)))return false;
    if(af==='OOS'&&r.abs!=='OOS')return false;
    if(af==='OOT'&&r.abs!=='OOT')return false;
    if(af==='any'&&!r.abs)return false;
    if(af==='indiv'&&r.corp)return false;
    if(gf==='PASS'&&!(r.gate||'').startsWith('PASS'))return false;
    if(gf==='KILL'&&(r.gate||'').startsWith('KILL'))return false;
    return true;
  });
  rows.sort((a,b)=>{let x=a[sortKey],y=b[sortKey];if(x==null)x=sortDir>0?1e18:-1e18;if(y==null)y=sortDir>0?1e18:-1e18;if(typeof x==='string')return sortDir*x.localeCompare(y);return sortDir*(x-y);});
  document.getElementById('count').textContent=rows.length.toLocaleString()+' parcels';
  document.getElementById('rows').innerHTML=rows.slice(0,800).map(r=>{
    const map=(r.lat&&r.lon)?`<a href="https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}" target="_blank">map↗</a>`:'<span class="muted">—</span>';
    return `<tr>
    <td class="lead ${leadClass(r.lead)}">${r.lead}</td><td>${gateCell(r.gate)}</td>
    <td class="l">${r.owner}${r.corp?' <span class="muted" style="font-size:10px">(corp)</span>':''}</td><td>${absCell(r.abs)}</td>
    <td>${r.acres}</td><td>${r.tier}</td><td>${r.cls}</td>
    <td class="l">${r.addr}</td><td class="l">${r.muni}</td>
    <td>${money(r.fmv)}</td><td>${money(r.ppa)}</td>
    <td class="l">${r.mailcity}${r.mailstate?(', '+r.mailstate):''}</td><td class="l">${r.water||'<span class="muted">—</span>'}</td>
    <td>${r.flood||'<span class="muted">—</span>'}</td><td>${r.wet||'<span class="muted">—</span>'}</td>
    <td>${r.slope==null?'<span class="muted">—</span>':r.slope}</td><td>${map}</td></tr>`;
  }).join('');
  if(rows.length>800)document.getElementById('count').textContent+=' (showing top 800)';
}
render();
</script></body></html>"""


# --- Main ------------------------------------------------------------------
def parse_args(argv):
    cfg = {"county": "Genesee", "min_acres": 1.0, "top": 30, "diligence": True}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--county" and i + 1 < len(argv):
            cfg["county"] = argv[i + 1]; i += 2
        elif a == "--min-acres" and i + 1 < len(argv):
            cfg["min_acres"] = float(argv[i + 1]); i += 2
        elif a == "--top" and i + 1 < len(argv):
            cfg["top"] = int(argv[i + 1]); i += 2
        elif a == "--no-diligence":
            cfg["diligence"] = False; i += 1
        elif not a.startswith("--"):
            cfg["county"] = a; i += 1
        else:
            i += 1
    return cfg


def main():
    cfg = parse_args(sys.argv[1:])
    county = cfg["county"]
    os.makedirs(OUTDIR, exist_ok=True)

    if county not in NY_COUNTIES:
        log(f"'{county}' is not in the free NYS parcel dataset.")
        log("Available counties (good land markets are in bold in the docs):")
        log("  " + ", ".join(sorted(NY_COUNTIES)))
        sys.exit(1)

    log(f"Parcel Scout — {county} County, NY")
    log(f"Pulling vacant-land parcels (>= {cfg['min_acres']} ac)...")
    parcels = fetch_parcels(county, cfg["min_acres"])
    if not parcels:
        log("No parcels returned. Try again (the state server may be busy)."); sys.exit(1)
    log(f"  {len(parcels)} vacant-land parcels.")

    enrich_and_rank(parcels)
    absentee = sum(1 for p in parcels if p["_out_of_state"] or p["_out_of_town"])
    log(f"  {absentee} absentee-owned (out of town/state) — your warm leads.")

    n_dilig = 0
    if cfg["diligence"]:
        run_diligence(parcels, cfg["top"])
        n_dilig = min(cfg["top"], len(parcels))
    else:
        log("Skipping auto-diligence (--no-diligence).")

    write_csv(parcels, county)
    html = write_html(parcels, county, n_dilig)

    top = parcels[0]
    log(f"\nDone. Top lead: {top.get('PRIMARY_OWNER')} — {top['_acres']}ac in "
        f"{top.get('MUNI_NAME')} (lead {top['_lead']}).")
    log(f"Open: {html}")
    try:
        if sys.platform == "darwin":
            os.system(f'open "{html}"')
    except Exception:
        pass


if __name__ == "__main__":
    main()
