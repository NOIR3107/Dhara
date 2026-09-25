"""
Master Data Ingestion Orchestrator for DHARA PostGIS Database
Runs all real & simulated dataset ingestions idempotently.
"""
import sys
import os
import psycopg2

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from ingest_landslides import ingest_landslides
from ingest_weather import ingest_weather
from ingest_habitations import ingest_habitations
from ingest_health_facilities import ingest_health_facilities
from ingest_districts import ingest_districts
from ingest_road_segments import ingest_road_segments
from ingest_simulated import ingest_simulated
from ingest_weather_forecasts import ingest_live_forecasts
from ingest_hazards import ingest_hazards

DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "dhara",
    "user": "ner",
    "password": "ner_dev_password"
}

def verify_database():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]

    results = []
    for t in tables:
        cur.execute(f"SELECT COUNT(*), COALESCE(MAX(data_provenance), 'REAL') FROM \"{t}\";")
        count, prov = cur.fetchone()
        results.append({"table": t, "count": count, "provenance": prov})

    conn.close()
    return results

def main():
    print("=== DHARA REAL DATA INGESTION PIPELINE ===", flush=True)
    ingest_districts()
    ingest_habitations()
    ingest_road_segments()
    ingest_weather()
    ingest_landslides()
    ingest_health_facilities()
    ingest_simulated()
    ingest_live_forecasts()
    ingest_hazards()

    print("\n=== FINAL DATABASE VERIFICATION ===", flush=True)
    summary = verify_database()
    for row in summary:
        print(f"  {row['table']:<22} | Rows: {row['count']:<6} | Provenance: {row['provenance']}", flush=True)

if __name__ == "__main__":
    main()
