"""
Ingest live hazard events into PostGIS table 'hazard_events'.

Sources (all REAL, external):
  USGS   — earthquakes M2.5+ in and around the North-East, last 14 days (keyless)
  GDACS  — tropical cyclone forecast cones + tracks for the North Indian Ocean,
           and flood alerts for India and its eastern neighbours (keyless, EU JRC)
  FIRMS  — VIIRS active fire detections, last 2 days (needs a free MAP_KEY in
           the FIRMS_MAP_KEY environment variable; skipped when absent)

Rows are upserted on (source, external_id), so re-running is idempotent.
Consumed by model/hazard_adjustment.py and the /hazards API endpoint.
"""
import csv
import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import psycopg2
import psycopg2.extras

sys.path.append(os.path.dirname(__file__))
from http_util import fetch, fetch_json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "dhara",
    "user": "ner",
    "password": "ner_dev_password"
}

# NE India plus Bhutan, south Tibet, north Myanmar and Bangladesh.
NE_BBOX = (85.5, 20.5, 98.5, 30.5)            # west, south, east, north
# Bay of Bengal / Arabian Sea basin for cyclones that can reach the North-East.
CYCLONE_BBOX = (60.0, 0.0, 100.0, 32.0)
FLOOD_COUNTRIES = {"India", "Bangladesh", "Bhutan", "Myanmar", "Nepal"}
LOOKBACK_DAYS = 14

SCHEMA = """
CREATE TABLE IF NOT EXISTS hazard_events (
    id SERIAL PRIMARY KEY,
    source VARCHAR(30) NOT NULL,
    event_type VARCHAR(30) NOT NULL,
    external_id VARCHAR(200) NOT NULL,
    title TEXT,
    magnitude FLOAT,
    severity VARCHAR(30),
    event_time TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    geom GEOMETRY(Geometry, 4326),
    properties JSONB,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    data_provenance VARCHAR(20) NOT NULL DEFAULT 'REAL',
    UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS hazard_events_geom_idx ON hazard_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS hazard_events_time_idx ON hazard_events (event_time);
"""


def _in_bbox(lon, lat, bbox):
    w, s, e, n = bbox
    return w <= lon <= e and s <= lat <= n


def _geojson_in_bbox(geometry, bbox):
    """True if any vertex of a GeoJSON geometry falls inside bbox."""
    def walk(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            return _in_bbox(c[0], c[1], bbox)
        return any(walk(x) for x in c)
    return walk(geometry.get("coordinates", []))


def fetch_usgs():
    w, s, e, n = NE_BBOX
    start = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")
    url = ("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson"
           f"&starttime={start}&minmagnitude=2.5"
           f"&minlatitude={s}&maxlatitude={n}&minlongitude={w}&maxlongitude={e}")
    data = fetch_json(url, ttl_seconds=600)
    rows = []
    for f in data.get("features", []):
        p = f["properties"]
        lon, lat, depth = f["geometry"]["coordinates"]
        rows.append({
            "source": "USGS", "event_type": "earthquake", "external_id": f["id"],
            "title": f"M{p.get('mag', 0):.1f} {p.get('place', '')}",
            "magnitude": p.get("mag"), "severity": p.get("alert"),
            "event_time": datetime.fromtimestamp(p["time"] / 1000, tz=timezone.utc),
            "valid_until": None,
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {"depth_km": depth, "url": p.get("url"), "felt": p.get("felt")},
        })
    return rows


def _gdacs_events(eventlist):
    today = datetime.now(timezone.utc)
    url = ("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
           f"?eventlist={eventlist}"
           f"&fromDate={(today - timedelta(days=LOOKBACK_DAYS)).strftime('%Y-%m-%d')}"
           f"&toDate={(today + timedelta(days=1)).strftime('%Y-%m-%d')}")
    return fetch_json(url, ttl_seconds=900).get("features", [])


def _parse_gdacs_time(s):
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "")).replace(tzinfo=timezone.utc)


def fetch_gdacs():
    rows = []

    # Tropical cyclones: keep events whose position or track touches the basin.
    for ev in _gdacs_events("TC"):
        p = ev["properties"]
        lon, lat = ev["geometry"]["coordinates"][:2]
        geom_url = p.get("url", {}).get("geometry")
        shapes = fetch_json(geom_url, ttl_seconds=900).get("features", []) if geom_url else []
        if not _in_bbox(lon, lat, CYCLONE_BBOX) and not any(
                _geojson_in_bbox(s["geometry"], CYCLONE_BBOX) for s in shapes):
            continue
        base = f"{p['eventid']}-{p['episodeid']}"
        wind = (p.get("severitydata") or {}).get("severity")
        common = {"eventid": p["eventid"], "episodeid": p["episodeid"], "name": p.get("name"),
                  "alertlevel": p.get("alertlevel"), "report": p.get("url", {}).get("report"),
                  "severitytext": (p.get("severitydata") or {}).get("severitytext")}
        rows.append({
            "source": "GDACS", "event_type": "cyclone", "external_id": f"TC-{base}-centre",
            "title": p.get("name"), "magnitude": wind, "severity": p.get("alertlevel"),
            "event_time": _parse_gdacs_time(p.get("fromdate")),
            "valid_until": _parse_gdacs_time(p.get("todate")),
            "geometry": ev["geometry"], "properties": dict(common, part="centre"),
        })
        for i, s in enumerate(shapes):
            sp = s.get("properties", {})
            cls = sp.get("Class", "")
            if cls.startswith("Poly_"):
                part = "cone_" + cls.split("_", 1)[1].lower()   # cone_green / cone_orange / cone_red
            elif cls.startswith("Line_"):
                part = "track_forecast" if sp.get("forecast") else "track_observed"
            else:
                continue
            valid = _parse_gdacs_time(sp.get("polygondate"))
            rows.append({
                "source": "GDACS", "event_type": "cyclone", "external_id": f"TC-{base}-{i}-{part}",
                "title": f"{p.get('name')} {sp.get('polygonlabel', '')}".strip(),
                "magnitude": wind, "severity": p.get("alertlevel"),
                "event_time": valid or _parse_gdacs_time(p.get("fromdate")),
                "valid_until": (valid + timedelta(hours=12)) if valid else _parse_gdacs_time(p.get("todate")),
                "geometry": s["geometry"],
                "properties": dict(common, part=part, label=sp.get("polygonlabel")),
            })

    # Flood alerts: coarse (country-level point), used as context only.
    for ev in _gdacs_events("FL"):
        p = ev["properties"]
        lon, lat = ev["geometry"]["coordinates"][:2]
        if p.get("country") not in FLOOD_COUNTRIES and not _in_bbox(lon, lat, NE_BBOX):
            continue
        rows.append({
            "source": "GDACS", "event_type": "flood_alert",
            "external_id": f"FL-{p['eventid']}-{p['episodeid']}",
            "title": p.get("name"), "magnitude": None, "severity": p.get("alertlevel"),
            "event_time": _parse_gdacs_time(p.get("fromdate")),
            "valid_until": _parse_gdacs_time(p.get("todate")),
            "geometry": ev["geometry"],
            "properties": {"country": p.get("country"), "report": p.get("url", {}).get("report"),
                           "description": p.get("htmldescription")},
        })
    return rows


def fetch_firms():
    key = os.environ.get("FIRMS_MAP_KEY")
    if not key:
        print("  FIRMS: skipped (set FIRMS_MAP_KEY — free at firms.modaps.eosdis.nasa.gov/api/map_key)", flush=True)
        return []
    w, s, e, n = NE_BBOX
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/VIIRS_SNPP_NRT/{w},{s},{e},{n}/2"
    text = fetch(url, ttl_seconds=1800).decode("utf-8")
    rows = []
    for r in csv.DictReader(io.StringIO(text)):
        try:
            lat, lon = float(r["latitude"]), float(r["longitude"])
        except (KeyError, ValueError):
            continue
        t = r.get("acq_time", "0000").zfill(4)
        when = datetime.strptime(f"{r['acq_date']} {t}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
        rows.append({
            "source": "FIRMS", "event_type": "fire",
            "external_id": f"{r['acq_date']}-{t}-{lat:.4f}-{lon:.4f}",
            "title": "VIIRS active fire", "magnitude": float(r.get("frp") or 0),
            "severity": r.get("confidence"), "event_time": when, "valid_until": None,
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {"frp_mw": r.get("frp"), "daynight": r.get("daynight")},
        })
    return rows


def upsert(rows):
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute(SCHEMA)
    values = [(
        r["source"], r["event_type"], r["external_id"], r["title"], r["magnitude"], r["severity"],
        r["event_time"], r["valid_until"], json.dumps(r["geometry"]), json.dumps(r["properties"]),
    ) for r in rows]
    if values:
        psycopg2.extras.execute_values(cur, """
            INSERT INTO hazard_events (source, event_type, external_id, title, magnitude, severity,
                                       event_time, valid_until, geom, properties)
            VALUES %s
            ON CONFLICT (source, external_id) DO UPDATE SET
                title = EXCLUDED.title, magnitude = EXCLUDED.magnitude, severity = EXCLUDED.severity,
                event_time = EXCLUDED.event_time, valid_until = EXCLUDED.valid_until,
                geom = EXCLUDED.geom, properties = EXCLUDED.properties, fetched_at = NOW();
        """, values,
            template="(%s, %s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), %s::jsonb)",
            page_size=1000)
    conn.commit()
    conn.close()


def ingest_hazards():
    all_rows = []
    for name, fn in (("USGS", fetch_usgs), ("GDACS", fetch_gdacs), ("FIRMS", fetch_firms)):
        try:
            rows = fn()
            print(f"  {name}: {len(rows)} hazard rows", flush=True)
            all_rows.extend(rows)
        except Exception as e:  # one failing feed must not block the others
            print(f"  {name}: FAILED ({e})", flush=True)
    upsert(all_rows)
    print(f"Hazard feeds → hazard_events → {len(all_rows)} rows upserted → REAL → SUCCESS", flush=True)
    return len(all_rows)


if __name__ == "__main__":
    ingest_hazards()
