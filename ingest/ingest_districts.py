"""
Ingest Official India District Boundaries (GADM / GeoBoundaries Level 2) into PostGIS database 'dhara'
Source: GeoBoundaries / GADM India ADM2
Table: districts
Provenance: REAL
"""
import sys
import os
import json
import urllib.request
import geopandas as gpd
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

URL = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IND/ADM2/geoBoundaries-IND-ADM2_simplified.geojson"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "real")
GEOJSON_PATH = os.path.join(DATA_DIR, "geoBoundaries-IND-ADM2.geojson")

def download_if_missing():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(GEOJSON_PATH):
        req = urllib.request.Request(URL, headers={"User-Agent": "DHARA-Ingest/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            with open(GEOJSON_PATH, "wb") as f:
                f.write(resp.read())

def ingest_districts():
    download_if_missing()
    gdf = gpd.read_file(GEOJSON_PATH)

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE districts RESTART IDENTITY CASCADE;")

    count = 0
    for _, row in gdf.iterrows():
        name = str(row.get("shapeName") or row.get("name") or "District")[:100]
        shape_id = str(row.get('shapeID') or name.lower().replace(' ', '_'))
        dist_id = f"dist_{shape_id}"
        geom_json = json.dumps(row.geometry.__geo_interface__)
        
        # Classify hill vs valley based on district names
        dist_type = "hill" if any(k in name.lower() for k in ["tawang", "kameng", "mon", "kohima", "gangtok", "shimla", "mandi", "hills", "darjeeling"]) else "valley"

        cur.execute("""
            INSERT INTO districts (id, name, type, geom, data_provenance)
            VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), 'REAL')
            ON CONFLICT (id) DO NOTHING;
        """, (dist_id, name, dist_type, geom_json))
        count += 1

    conn.commit()
    conn.close()

    status = "SUCCESS" if count > 0 else "FAILED"
    print(f"GADM / GeoBoundaries → districts → {count} → REAL → {status}", flush=True)
    return count

if __name__ == "__main__":
    ingest_districts()
