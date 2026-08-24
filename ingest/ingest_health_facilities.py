"""
Ingest OpenStreetMap Health Facilities into PostGIS database 'dhara'
Source: OpenStreetMap (Overpass API - Hospitals/Clinics/PHCs in NE India)
Table: health_facilities
Provenance: REAL
"""
import sys
import os
import json
import urllib.request
import urllib.parse
import psycopg2

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "dhara",
    "user": "ner",
    "password": "ner_dev_password"
}

def fetch_osm_health_facilities():
    # Overpass query for hospitals and clinics in North-East India bounding box
    query = """
    [out:json][timeout:30];
    (
      node["amenity"="hospital"](23.0,88.0,29.5,97.5);
      node["amenity"="clinic"](23.0,88.0,29.5,97.5);
    );
    out body;
    """
    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "DHARA-Ingest/1.0"})
    
    facilities = []
    with urllib.request.urlopen(req, timeout=40) as resp:
        res = json.loads(resp.read().decode())
        for elem in res.get("elements", []):
            tags = elem.get("tags", {})
            name = tags.get("name") or tags.get("name:en") or f"Facility {elem['id']}"
            fac_type = tags.get("amenity", "clinic")
            facilities.append({
                "id": f"osm_h_{elem['id']}",
                "name": name[:100],
                "facility_type": fac_type,
                "lat": float(elem["lat"]),
                "lon": float(elem["lon"])
            })
    return facilities

def ingest_health_facilities():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE health_facilities RESTART IDENTITY;")

    facilities = fetch_osm_health_facilities()
    count = 0
    for f in facilities:
        cur.execute("""
            INSERT INTO health_facilities (id, name, facility_type, location, data_provenance)
            VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 'REAL')
            ON CONFLICT (id) DO NOTHING;
        """, (f["id"], f["name"], f["facility_type"], f["lon"], f["lat"]))
        count += 1

    conn.commit()
    conn.close()

    status = "SUCCESS" if count > 0 else "FAILED"
    print(f"OpenStreetMap → health_facilities → {count} → REAL → {status}", flush=True)
    return count

if __name__ == "__main__":
    ingest_health_facilities()
