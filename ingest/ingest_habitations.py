"""
Ingest GeoNames India Habitations into PostGIS database 'dhara'
Source: GeoNames IN.zip (Populated places in NE India)
Table: habitations
Provenance: REAL
"""
import sys
import os
import zipfile
import urllib.request
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

URL = "https://download.geonames.org/export/dump/IN.zip"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "real")
ZIP_PATH = os.path.join(DATA_DIR, "IN.zip")

def download_if_missing():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(ZIP_PATH):
        req = urllib.request.Request(URL, headers={"User-Agent": "DHARA-Ingest/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            with open(ZIP_PATH, "wb") as f:
                f.write(resp.read())

def ingest_habitations():
    download_if_missing()
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE habitations RESTART IDENTITY CASCADE;")

    count = 0
    with zipfile.ZipFile(ZIP_PATH) as z:
        with z.open("IN.txt") as f:
            for line in f:
                parts = line.decode("utf-8", errors="ignore").split("\t")
                if len(parts) > 14:
                    geonameid, name, asciiname, alternatenames, lat, lon, fclass, fcode, ccode = parts[:9]
                    pop_str = parts[14]
                    try:
                        lat_f, lon_f = float(lat), float(lon)
                        pop_val = int(pop_str) if pop_str and pop_str.isdigit() else 250
                        # North-East India bounding box: lat 23.0 to 29.5, lon 88.0 to 97.5
                        if 23.0 <= lat_f <= 29.5 and 88.0 <= lon_f <= 97.5 and fclass in ['P']:
                            hab_id = f"hab_{geonameid}"
                            cur.execute("""
                                INSERT INTO habitations (id, name, population, location, data_provenance)
                                VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 'REAL')
                                ON CONFLICT (id) DO NOTHING;
                            """, (hab_id, name[:100], max(pop_val, 100), lon_f, lat_f))
                            count += 1
                    except ValueError:
                        pass

    conn.commit()
    conn.close()

    status = "SUCCESS" if count > 0 else "FAILED"
    print(f"GeoNames → habitations → {count} → REAL → {status}", flush=True)
    return count

if __name__ == "__main__":
    ingest_habitations()
