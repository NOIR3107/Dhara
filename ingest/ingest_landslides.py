"""
Ingest NASA COOLR Landslide Catalog into PostGIS database 'dhara'
Source: NASA / HDX (Global Landslide Catalog)
Table: landslide_events
Provenance: REAL
"""
import sys
import os
import zipfile
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

ZIP_URL = "https://data.humdata.org/dataset/1eb911ba-3681-4a96-b025-ae0c33b80a12/resource/ed703c45-2001-4286-ba16-8248c17fec80/download/global_landslide_catalog_nasa.zip"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "real")
ZIP_PATH = os.path.join(DATA_DIR, "global_landslide_catalog_nasa.zip")

def download_if_missing():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(ZIP_PATH):
        req = urllib.request.Request(ZIP_URL, headers={"User-Agent": "DHARA-Ingest/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            with open(ZIP_PATH, "wb") as f:
                f.write(resp.read())

def ingest_landslides():
    download_if_missing()
    gdf = gpd.read_file(f"zip://{ZIP_PATH}!global_landslide_catalog_NASA.shp")
    india_gdf = gdf[gdf['country_na'] == 'India']

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # Idempotent clean insert
    cur.execute("TRUNCATE TABLE landslide_events RESTART IDENTITY;")
    
    count = 0
    for _, row in india_gdf.iterrows():
        loc_desc = str(row.get('location_d') or '')[:500]
        raw_date = str(row.get('event_date') or '')
        evt_date = None
        if raw_date:
            parts = raw_date.split(' ')[0].split('/')
            if len(parts) == 3:
                evt_date = f"{parts[2]}-{parts[0].zfill(2)}-{parts[1].zfill(2)}"
        
        source_name = str(row.get('source_nam') or 'NASA COOLR')[:100]
        lon = float(row.get('longitude') or row.geometry.x)
        lat = float(row.get('latitude') or row.geometry.y)
        
        cur.execute("""
            INSERT INTO landslide_events (location_description, event_date, location, source_name, data_provenance)
            VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, 'REAL');
        """, (loc_desc, evt_date, lon, lat, source_name))
        count += 1

    conn.commit()
    conn.close()

    status = "SUCCESS" if count > 0 else "FAILED"
    print(f"NASA COOLR → landslide_events → {count} → REAL → {status}", flush=True)
    return count

if __name__ == "__main__":
    ingest_landslides()
