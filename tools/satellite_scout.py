#!/usr/bin/env python3
"""
Satellite Scout — Engine 4: vet the top Parcel Scout leads from the sky.

Takes the ranked leads in output/parcels-<County>.csv and, for each one:
  1. pulls the parcel polygon from the free NYS tax-parcel service,
  2. samples the ESA/Esri Sentinel-2 10 m land-cover raster at points inside
     the polygon → % trees / open (crops+range+bare) / wet (water+flooded) / built,
  3. measures road access against TIGERweb local roads (frontage vs distance —
     the landlocked kill-gate, estimated for free),
  4. downloads a satellite close-up (Esri World Imagery) with the parcel
     boundary drawn on top,
  5. scores it all into an EYEBALL score (0–100): "would a buyer like what
     they see from the air?"

Output: output/satellite-review-<County>.html — a photo gallery you can flip
through in seconds, mark ✓ keep / ✗ reject, and export the keepers as a CSV
ready to skip-trace and import into app/lead-manager.html.

Free, no API keys. Usage:
    python3 satellite_scout.py --county Genesee --top 40
"""

import argparse, csv, json, math, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, "output")

PARCELS_URL = ("https://gisservices.its.ny.gov/arcgis/rest/services/"
               "NYS_Tax_Parcels_Public/FeatureServer/1/query")
LANDCOVER_URL = ("https://ic.imagery1.arcgis.com/arcgis/rest/services/"
                 "Sentinel2_10m_LandCover/ImageServer/identify")
ROADS_URL = ("https://tigerweb.geo.census.gov/arcgis/rest/services/"
             "TIGERweb/Transportation/MapServer/8/query")   # 8 = Local Roads
IMAGERY_URL = ("https://services.arcgisonline.com/ArcGIS/rest/services/"
               "World_Imagery/MapServer/export")

# Sentinel-2 10m land-cover classes (Impact Observatory / Esri Living Atlas)
LC_CLASSES = {
    "1": "water", "2": "trees", "4": "wet", "5": "open",     # 4 flooded veg, 5 crops
    "7": "built", "8": "open", "9": "other", "10": "other",  # 8 bare ground
    "11": "open",                                            # rangeland
}
LC_YEAR = 2023


def log(m): print(m, flush=True)


def get(url, params, timeout=30, tries=3, binary=False):
    """GET with retries. Returns bytes/str, or None on failure (never raises)."""
    full = url + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            req = urllib.request.Request(full, headers={"User-Agent": "satellite-scout/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
                return data if binary else data.decode("utf-8", "replace")
        except Exception:
            if i + 1 < tries:
                time.sleep(1.5 * (i + 1))
    return None


def get_json(url, params, timeout=30, tries=3):
    raw = get(url, params, timeout, tries)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


# --- geometry helpers (pure math, WGS84 + Web Mercator) ---------------------
R_MERC = 20037508.342789244

def merc(lon, lat):
    x = lon * R_MERC / 180.0
    y = math.log(math.tan((90 + lat) * math.pi / 360.0)) * R_MERC / math.pi
    return x, y


def point_in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def dist_m(lon1, lat1, lon2, lat2):
    """Fast equirectangular distance in meters (fine at parcel scale)."""
    kx = 111320 * math.cos(math.radians((lat1 + lat2) / 2))
    ky = 110540
    return math.hypot((lon2 - lon1) * kx, (lat2 - lat1) * ky)


def dist_to_segment_m(px, py, ax, ay, bx, by):
    """Distance (m) from point P to segment AB, all in lon/lat."""
    kx = 111320 * math.cos(math.radians(py))
    ky = 110540
    p = ((px) * kx, (py) * ky)
    a = ((ax) * kx, (ay) * ky)
    b = ((bx) * kx, (by) * ky)
    abx, aby = b[0] - a[0], b[1] - a[1]
    l2 = abx * abx + aby * aby
    if l2 == 0:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    t = max(0.0, min(1.0, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / l2))
    cx, cy = a[0] + t * abx, a[1] + t * aby
    return math.hypot(p[0] - cx, p[1] - cy)


# --- per-parcel stages -------------------------------------------------------
def fetch_geometry(county, print_key):
    d = get_json(PARCELS_URL, {
        "where": f"COUNTY_NAME='{county}' AND PRINT_KEY='{print_key}'",
        "outFields": "OBJECTID,ACRES", "returnGeometry": "true",
        "returnCentroid": "true", "outSR": "4326", "f": "json"}, timeout=45)
    try:
        f = d["features"][0]
        rings = f["geometry"]["rings"]
        c = f.get("centroid") or {}
        outer = max(rings, key=len)
        xs = [p[0] for p in outer]; ys = [p[1] for p in outer]
        cx = c.get("x") or sum(xs) / len(xs)
        cy = c.get("y") or sum(ys) / len(ys)
        return {"rings": rings, "outer": outer, "cx": cx, "cy": cy,
                "bbox": (min(xs), min(ys), max(xs), max(ys))}
    except Exception:
        return None


def sample_points(geom, want=6):
    """Centroid + a small grid of interior points (≤ want total)."""
    pts = []
    cx, cy = geom["cx"], geom["cy"]
    if point_in_ring(cx, cy, geom["outer"]):
        pts.append((cx, cy))
    x0, y0, x1, y1 = geom["bbox"]
    for gy in (0.25, 0.5, 0.75):
        for gx in (0.25, 0.5, 0.75):
            if len(pts) >= want:
                break
            px, py = x0 + gx * (x1 - x0), y0 + gy * (y1 - y0)
            if point_in_ring(px, py, geom["outer"]) and all(dist_m(px, py, qx, qy) > 15 for qx, qy in pts):
                pts.append((px, py))
    return pts or [(cx, cy)]


def land_cover(points):
    """Sample the Sentinel-2 10m land-cover class at each point → share per group."""
    counts = {}
    for lon, lat in points:
        d = get_json(LANDCOVER_URL, {
            "geometry": json.dumps({"x": lon, "y": lat, "spatialReference": {"wkid": 4326}}),
            "geometryType": "esriGeometryPoint",
            "mosaicRule": json.dumps({"mosaicMethod": "esriMosaicAttribute",
                                      "where": f"Year = {LC_YEAR}"}),
            "returnGeometry": "false", "returnCatalogItems": "false", "f": "json"},
            timeout=25, tries=2)
        cls = LC_CLASSES.get(str((d or {}).get("value", "")).strip(), None)
        if cls:
            counts[cls] = counts.get(cls, 0) + 1
        time.sleep(0.15)
    n = sum(counts.values())
    if n == 0:
        return None
    return {k: counts.get(k, 0) / n for k in ("trees", "open", "wet", "water", "built", "other")}


def road_access(geom):
    """Frontage (road crosses the parcel bbox) or distance to nearest local road."""
    x0, y0, x1, y1 = geom["bbox"]
    d = get_json(ROADS_URL, {
        "geometry": json.dumps({"xmin": x0, "ymin": y0, "xmax": x1, "ymax": y1,
                                "spatialReference": {"wkid": 4326}}),
        "geometryType": "esriGeometryEnvelope", "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "NAME", "returnGeometry": "false", "f": "json"}, timeout=35)
    if d and d.get("features"):
        return 0, (d["features"][0]["attributes"].get("NAME") or "unnamed road")
    # nothing touches the bbox — how far is the nearest road?
    cx, cy = geom["cx"], geom["cy"]
    d = get_json(ROADS_URL, {
        "geometry": f"{cx},{cy}", "geometryType": "esriGeometryPoint", "inSR": "4326",
        "distance": 1500, "units": "esriSRUnit_Meter",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "NAME", "returnGeometry": "true", "outSR": "4326", "f": "json"}, timeout=35)
    best, name = None, None
    for f in (d or {}).get("features", []):
        for path in (f.get("geometry") or {}).get("paths", []):
            for i in range(len(path) - 1):
                m = dist_to_segment_m(cx, cy, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1])
                if best is None or m < best:
                    best, name = m, (f["attributes"].get("NAME") or "unnamed road")
    return (round(best) if best is not None else None), name


def fetch_image(geom, path, px=520):
    """Square satellite close-up around the parcel; returns mercator bbox used."""
    x0, y0 = merc(geom["bbox"][0], geom["bbox"][1])
    x1, y1 = merc(geom["bbox"][2], geom["bbox"][3])
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = max(x1 - x0, y1 - y0) / 2 * 1.45 + 30   # pad 45% + 30 m
    bbox = (cx - half, cy - half, cx + half, cy + half)
    if not os.path.exists(path):
        img = get(IMAGERY_URL, {
            "bbox": ",".join(str(v) for v in bbox), "bboxSR": "3857", "imageSR": "3857",
            "size": f"{px},{px}", "format": "jpg", "f": "image"}, timeout=45, binary=True)
        if img and img[:3] == b"\xff\xd8\xff":
            with open(path, "wb") as fh:
                fh.write(img)
        else:
            return None
    return bbox


def eyeball_score(lc, road_m, slope_deg, flood, wetland):
    """0–100: how good does this parcel look from the sky?  Weighted blend of
    usable/dry ground, road access, and the diligence gates we already know."""
    parts, weights = [], []
    if lc:
        wet_share = lc["wet"] + lc["water"]
        usable = lc["open"] + 0.55 * lc["trees"]     # wooded is sellable, open is easier
        parts.append(min(1.0, usable)); weights.append(0.30)
        parts.append(max(0.0, 1.0 - 2.5 * wet_share)); weights.append(0.30)
    if road_m is not None:
        acc = 1.0 if road_m <= 5 else 0.8 if road_m <= 100 else 0.45 if road_m <= 400 else 0.1
        parts.append(acc); weights.append(0.25)
    elif road_m is None:
        parts.append(0.05); weights.append(0.25)     # no road within 1.5 km — landlocked risk
    if slope_deg not in (None, ""):
        try:
            s = float(slope_deg)
            parts.append(1.0 if s < 5 else 0.6 if s < 10 else 0.2); weights.append(0.15)
        except ValueError:
            pass
    gate_pen = 0.0
    if (flood or "").strip() not in ("", "X", "None", "OPEN WATER?"):
        gate_pen += 0.25
    if (wetland or "").strip() not in ("", "None"):
        gate_pen += 0.25
    if not weights:
        return None
    raw = sum(p * w for p, w in zip(parts, weights)) / sum(weights)
    return round(max(0.0, raw - gate_pen) * 100, 1)


# --- report ------------------------------------------------------------------
def svg_overlay(geom, mbbox, px=520):
    """SVG polygon of the parcel in image pixel space."""
    bx0, by0, bx1, by1 = mbbox
    polys = []
    for ring in geom["rings"]:
        pts = []
        for lon, lat in ring:
            mx, my = merc(lon, lat)
            X = (mx - bx0) / (bx1 - bx0) * px
            Y = (by1 - my) / (by1 - by0) * px
            pts.append(f"{X:.1f},{Y:.1f}")
        polys.append("<polygon points='" + " ".join(pts) +
                     "' fill='rgba(63,185,80,.08)' stroke='#3fb950' stroke-width='2.5'/>")
    return "".join(polys)


def build_html(county, cards):
    css = """
    :root { --bg:#0f1419; --panel:#1a2129; --panel2:#222c36; --line:#2e3a46; --text:#e6edf3;
            --muted:#8b9bab; --good:#3fb950; --accent2:#58a6ff; --warn:#d29922; --bad:#f85149; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--text);
      font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    header { padding:18px 26px; border-bottom:1px solid var(--line); }
    h1 { margin:0; font-size:20px; } .sub { color:var(--muted); font-size:13px; }
    .wrap { max-width:1280px; margin:0 auto; padding:20px 26px 90px; }
    .toolbar { display:flex; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
    button { background:var(--panel2); color:var(--text); border:1px solid var(--line);
      border-radius:8px; padding:8px 14px; font-size:14px; cursor:pointer; }
    button:hover { border-color:var(--accent2); }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:18px; }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
    .card.kept { border-color:var(--good); } .card.rejected { opacity:.35; }
    .imgwrap { position:relative; } .imgwrap img { width:100%; display:block; }
    .imgwrap svg { position:absolute; inset:0; width:100%; height:100%; }
    .score { position:absolute; top:10px; left:10px; background:rgba(15,20,25,.85);
      border-radius:10px; padding:4px 12px; font-size:19px; font-weight:800; }
    .body { padding:12px 16px 16px; }
    .name { font-weight:700; } .meta { color:var(--muted); font-size:12.5px; margin:2px 0 8px; }
    .bar { display:flex; height:12px; border-radius:6px; overflow:hidden; margin:8px 0 4px; border:1px solid var(--line); }
    .bar div { height:100%; } .legend { font-size:11.5px; color:var(--muted); margin-bottom:8px; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0; }
    .chip { font-size:11.5px; padding:2px 9px; border-radius:14px; border:1px solid var(--line); color:var(--muted); }
    .chip.good { color:var(--good); border-color:var(--good); }
    .chip.warn { color:var(--warn); border-color:var(--warn); }
    .chip.bad { color:var(--bad); border-color:var(--bad); }
    .actions { display:flex; gap:8px; margin-top:10px; }
    .actions a { color:var(--accent2); font-size:13px; align-self:center; text-decoration:none; }
    .keep { color:var(--good); } .rej { color:var(--bad); }
    .count { color:var(--muted); font-size:13px; }
    """
    js = """
    const KEY='satscout-COUNTY';
    let marks = JSON.parse(localStorage.getItem(KEY)||'{}');
    function paint(){
      document.querySelectorAll('.card').forEach(c=>{
        const k=c.dataset.key; c.classList.toggle('kept',marks[k]==='keep');
        c.classList.toggle('rejected',marks[k]==='rej');
      });
      const kept=Object.values(marks).filter(v=>v==='keep').length;
      document.getElementById('count').textContent=kept+' kept · '+Object.values(marks).filter(v=>v==='rej').length+' rejected';
    }
    function mark(k,v){ marks[k]=marks[k]===v?undefined:v; localStorage.setItem(KEY,JSON.stringify(marks)); paint(); }
    function exportKept(){
      const rows=[...document.querySelectorAll('.card')].filter(c=>marks[c.dataset.key]==='keep');
      if(!rows.length){ alert('Mark some parcels ✓ keep first.'); return; }
      const cols=JSON.parse(rows[0].dataset.cols);
      const lines=[cols.join(',')];
      for(const c of rows){ const d=JSON.parse(c.dataset.row);
        lines.push(cols.map(x=>'"'+String(d[x]??'').replace(/"/g,'""')+'"').join(',')); }
      const a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([lines.join('\\n')],{type:'text/csv'}));
      a.download='satellite-keepers-COUNTY.csv'; a.click();
    }
    window.addEventListener('DOMContentLoaded',paint);
    """.replace("COUNTY", county)
    head = (f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
            f"<title>Satellite Review — {county}</title><style>{css}</style>"
            f"<script>{js}</script></head><body>"
            f"<header><h1>🛰️ Satellite Review — {county} County</h1>"
            f"<div class='sub'>Top Parcel Scout leads, vetted from the sky: land cover (Sentinel-2 10 m) · "
            f"road access (TIGER) · EYEBALL score. Flip through, ✓ keep the good ones, export, skip-trace, "
            f"then import into the Lead Manager.</div></header><div class='wrap'>"
            f"<div class='toolbar'><button onclick='exportKept()'>⬇ Export ✓ kept as CSV</button>"
            f"<span class='count' id='count'></span></div><div class='grid'>")
    return head + "".join(cards) + "</div></div></body></html>"


def chipset(lc, road_m, road_name, flood, wetland, slope):
    chips = []
    if lc:
        if lc["open"] >= 0.5: chips.append(("🌾 mostly open", "good"))
        elif lc["trees"] >= 0.5: chips.append(("🌲 mostly wooded", ""))
        wet = lc["wet"] + lc["water"]
        if wet >= 0.3: chips.append(("💧 wet ground", "bad"))
        elif wet > 0: chips.append(("💧 some water", "warn"))
        if lc["built"] > 0: chips.append(("🏠 structure?", "warn"))
    else:
        chips.append(("land cover n/a", "warn"))
    if road_m is None:
        chips.append(("🚫 no road ≤1.5 km — landlocked?", "bad"))
    elif road_m <= 5:
        chips.append((f"🛣 frontage: {road_name}", "good"))
    elif road_m <= 400:
        chips.append((f"🛣 road {road_m} m ({road_name})", ""))
    else:
        chips.append((f"🛣 road {road_m} m — check access", "warn"))
    if (flood or "").strip() not in ("", "X", "None"):
        chips.append((f"🌊 flood {flood}", "bad"))
    if (wetland or "").strip() not in ("", "None"):
        chips.append(("🥀 wetland gate", "bad"))
    if slope:
        try:
            s = float(slope)
            chips.append((f"⛰ slope {s:.0f}°", "bad" if s >= 10 else "warn" if s >= 5 else "good"))
        except ValueError:
            pass
    return "".join(f"<span class='chip {c}'>{t}</span>" for t, c in chips)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--county", default="Genesee")
    ap.add_argument("--top", type=int, default=40, help="how many top leads to vet")
    ap.add_argument("--individuals-only", action="store_true", default=True)
    args = ap.parse_args()

    src = os.path.join(OUTDIR, f"parcels-{args.county}.csv")
    if not os.path.exists(src):
        log(f"ERROR: {src} not found — run Parcel Scout for {args.county} first.")
        sys.exit(1)
    with open(src, newline="") as fh:
        rows = list(csv.DictReader(fh))
    leads = [r for r in rows if r.get("print_key", "").strip()
             and (not args.individuals_only or r.get("owner_type") == "individual")]
    leads = leads[: args.top]
    log(f"Satellite Scout — {args.county}: vetting top {len(leads)} leads "
        f"(of {len(rows)} in {os.path.basename(src)})")

    imgdir = os.path.join(OUTDIR, "satellite", args.county)
    os.makedirs(imgdir, exist_ok=True)
    cols = list(rows[0].keys()) + ["eyeball", "pct_trees", "pct_open", "pct_wet", "road_m", "road_name"]

    cards, out_rows, t0 = [], [], time.time()
    for i, r in enumerate(leads, 1):
        pk = r["print_key"]
        log(f"  [{i}/{len(leads)}] {pk} — {r.get('owner','')[:40]}")
        geom = fetch_geometry(args.county, pk)
        if not geom:
            log("      ! geometry not found, skipping")
            continue
        pts = sample_points(geom)
        lc = land_cover(pts)
        road_m, road_name = road_access(geom)
        safe = pk.replace("/", "_").replace(" ", "_")
        imgpath = os.path.join(imgdir, f"{safe}.jpg")
        mbbox = fetch_image(geom, imgpath)
        score = eyeball_score(lc, road_m, r.get("slope_deg"), r.get("flood"), r.get("wetland"))

        d = dict(r)
        d.update({"eyeball": score, "lat": round(geom["cy"], 6), "lon": round(geom["cx"], 6),
                  "pct_trees": round(100 * lc["trees"]) if lc else "",
                  "pct_open": round(100 * lc["open"]) if lc else "",
                  "pct_wet": round(100 * (lc["wet"] + lc["water"])) if lc else "",
                  "road_m": road_m if road_m is not None else "",
                  "road_name": road_name or ""})
        out_rows.append(d)

        img_rel = f"satellite/{args.county}/{safe}.jpg"
        overlay = svg_overlay(geom, mbbox) if mbbox else ""
        bar = ""
        if lc:
            wet = lc["wet"] + lc["water"]
            other = max(0.0, 1 - lc["trees"] - lc["open"] - wet - lc["built"])
            bar = ("<div class='bar'>"
                   f"<div style='width:{lc['open']*100:.0f}%;background:#8fbf4d' title='open'></div>"
                   f"<div style='width:{lc['trees']*100:.0f}%;background:#2e6b3a' title='trees'></div>"
                   f"<div style='width:{wet*100:.0f}%;background:#3d7dd6' title='wet'></div>"
                   f"<div style='width:{lc['built']*100:.0f}%;background:#c4281b' title='built'></div>"
                   f"<div style='width:{other*100:.0f}%;background:#555' title='other'></div></div>"
                   f"<div class='legend'>🌾 open {lc['open']*100:.0f}% · 🌲 trees {lc['trees']*100:.0f}% · "
                   f"💧 wet {wet*100:.0f}%</div>")
        gmaps = f"https://www.google.com/maps/@{geom['cy']},{geom['cx']},700m/data=!3m1!1e3"
        score_txt = f"{score:.0f}" if score is not None else "?"
        score_col = "#3fb950" if (score or 0) >= 70 else "#d29922" if (score or 0) >= 45 else "#f85149"
        row_json = json.dumps({k: d.get(k, "") for k in cols}).replace("'", "&#39;")
        cards.append(
            f"<div class='card' data-key='{safe}' data-cols='{json.dumps(cols)}' data-row='{row_json}'>"
            f"<div class='imgwrap'><img src='{img_rel}' loading='lazy'>"
            f"<svg viewBox='0 0 520 520' preserveAspectRatio='none'>{overlay}</svg>"
            f"<div class='score' style='color:{score_col}'>👁 {score_txt}</div></div>"
            f"<div class='body'><div class='name'>{r.get('owner','')}</div>"
            f"<div class='meta'>{r.get('acres','?')} ac · {r.get('address','') or '(no address)'} · "
            f"{r.get('muni','')} · lead {r.get('lead','')} · APN {pk}</div>"
            f"{bar}<div class='chips'>{chipset(lc, road_m, road_name, r.get('flood'), r.get('wetland'), r.get('slope_deg'))}</div>"
            f"<div class='actions'><button class='keep' onclick=\"mark('{safe}','keep')\">✓ Keep</button>"
            f"<button class='rej' onclick=\"mark('{safe}','rej')\">✗ Reject</button>"
            f"<a href='{gmaps}' target='_blank'>Google sat ↗</a></div></div></div>")

    html_path = os.path.join(OUTDIR, f"satellite-review-{args.county}.html")
    with open(html_path, "w") as fh:
        fh.write(build_html(args.county, cards))
    csv_path = os.path.join(OUTDIR, f"satellite-review-{args.county}.csv")
    with open(csv_path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader(); w.writerows(out_rows)

    log(f"\nDone in {time.time()-t0:.0f}s → {html_path}")
    log(f"                     data → {csv_path}")
    if sys.platform == "darwin" and cards:
        os.system(f"open '{html_path}'")


if __name__ == "__main__":
    main()
