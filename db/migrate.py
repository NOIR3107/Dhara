"""
DHARA Schema & Migration Script for PostgreSQL 16 + PostGIS 3.4
Target DB: postgresql://ner:ner_dev_password@localhost:5433/dhara
"""
import os
import sys

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "ingest"))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "model"))
from ingest_hazards import SCHEMA as HAZARD_EVENTS_SCHEMA
from hazard_adjustment import FLAGS_SCHEMA

DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "dhara",
    "user": "ner",
    "password": "ner_dev_password"
}

TABLES_DDL = [
    # 1. Districts (GEOMETRY allows Polygon/MultiPolygon)
    """
    CREATE TABLE IF NOT EXISTS districts (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        geom GEOMETRY(Geometry, 4326),
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'REAL'
    );
    """,
    # 2. Habitations
    """
    CREATE TABLE IF NOT EXISTS habitations (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        district_id VARCHAR(100) REFERENCES districts(id),
        population INTEGER,
        location GEOGRAPHY(Point, 4326),
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'REAL'
    );
    """,
    # 3. Road Segments
    """
    CREATE TABLE IF NOT EXISTS road_segments (
        segment_id VARCHAR(100) PRIMARY KEY,
        district_id VARCHAR(100),
        road_type VARCHAR(50),
        slope_deg FLOAT,
        landslide_class INTEGER,
        flood_class INTEGER,
        geom GEOMETRY(Geometry, 4326),
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'REAL'
    );
    """,
    # 4. Weather Observations
    """
    CREATE TABLE IF NOT EXISTS weather_observations (
        id SERIAL PRIMARY KEY,
        segment_id VARCHAR(100),
        observation_date DATE NOT NULL,
        rainfall_mm FLOAT,
        forecast_rainfall_mm FLOAT,
        observed_closure BOOLEAN,
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'REAL'
    );
    """,
    # 5. NASA COOLR Landslide Events
    """
    CREATE TABLE IF NOT EXISTS landslide_events (
        event_id SERIAL PRIMARY KEY,
        location_description TEXT,
        event_date DATE,
        location GEOGRAPHY(Point, 4326),
        source_name VARCHAR(100),
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'REAL'
    );
    """,
    # 6. Health Facilities (OSM)
    """
    CREATE TABLE IF NOT EXISTS health_facilities (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100),
        facility_type VARCHAR(50),
        location GEOGRAPHY(Point, 4326),
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'REAL'
    );
    """,
    # 7. Depots (Stock simulated)
    """
    CREATE TABLE IF NOT EXISTS depots (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location GEOGRAPHY(Point, 4326),
        stock_ration_packs INTEGER,
        stock_med_kits INTEGER,
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'SIMULATED'
    );
    """,
    # 8. VRI Forecasts (Derived)
    """
    CREATE TABLE IF NOT EXISTS vri_forecasts (
        id SERIAL PRIMARY KEY,
        village_id VARCHAR(100),
        forecast_date DATE,
        vri FLOAT,
        reachability_prob FLOAT,
        confidence FLOAT,
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'DERIVED'
    );
    """,
    # 9. Countdown Status (Derived)
    """
    CREATE TABLE IF NOT EXISTS countdown_status (
        village_id VARCHAR(100) PRIMARY KEY,
        hours_until_cutoff FLOAT,
        status VARCHAR(50),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'DERIVED'
    );
    """,
    # 10. Egress Metrics (Derived)
    """
    CREATE TABLE IF NOT EXISTS egress_metrics (
        village_id VARCHAR(100) PRIMARY KEY,
        travel_time_now_min FLOAT,
        travel_time_after_min FLOAT,
        delta_min FLOAT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'DERIVED'
    );
    """,
    # 11. Dispatch Decisions (Derived)
    """
    CREATE TABLE IF NOT EXISTS dispatch_decisions (
        id SERIAL PRIMARY KEY,
        village_id VARCHAR(100),
        depot_id VARCHAR(100),
        units_required INTEGER,
        units_shipped INTEGER,
        tier VARCHAR(50),
        reasoning TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'DERIVED'
    );
    """,
    # 12. Audit Log (Derived)
    """
    CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100),
        confidence FLOAT,
        reasoning TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'DERIVED'
    );
    """,
    # 13. Simulated Vehicles & Telemetry (Simulated)
    """
    CREATE TABLE IF NOT EXISTS simulated_telemetry (
        vehicle_id VARCHAR(100) PRIMARY KEY,
        depot_id VARCHAR(100),
        location GEOGRAPHY(Point, 4326),
        speed_kmh FLOAT,
        status VARCHAR(50),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'SIMULATED'
    );
    """,
    # 14. Weather Forecasts (Real Live Feed)
    """
    CREATE TABLE IF NOT EXISTS weather_forecasts (
        id SERIAL PRIMARY KEY,
        segment_id VARCHAR(100),
        forecast_date DATE NOT NULL,
        rainfall_mm FLOAT,
        source_type VARCHAR(50) DEFAULT 'OPEN_METEO_LIVE',
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'REAL'
    );
    """,
    # 15. Disruption Forecasts (Segment Closure Predictions - Derived)
    """
    CREATE TABLE IF NOT EXISTS disruption_forecasts (
        id SERIAL PRIMARY KEY,
        segment_id VARCHAR(100),
        forecast_for_date DATE NOT NULL,
        closure_probability FLOAT,
        predicted_closed BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'DERIVED'
    );
    """,
    # 16. Weather forecast antecedent / look-ahead rain (ingest_weather_forecasts.py)
    "ALTER TABLE weather_forecasts ADD COLUMN IF NOT EXISTS rain_72h_mm FLOAT;",
    "ALTER TABLE weather_forecasts ADD COLUMN IF NOT EXISTS rain_next_72h_mm FLOAT;",
    # 17. Live hazard events (ingest_hazards.py) and 18. hazard-driven forecast adjustments (hazard_adjustment.py)
    HAZARD_EVENTS_SCHEMA,
    FLAGS_SCHEMA,
    # 19. Officer map annotations (shared; soft-deleted for after-action review)
    """
    CREATE TABLE IF NOT EXISTS map_annotations (
        id SERIAL PRIMARY KEY,
        kind VARCHAR(30) NOT NULL,
        label VARCHAR(120) NOT NULL,
        author VARCHAR(60) NOT NULL,
        geom GEOMETRY(Geometry, 4326) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        deleted_by VARCHAR(60),
        data_provenance VARCHAR(20) NOT NULL DEFAULT 'REAL'
    );
    """,
    "CREATE INDEX IF NOT EXISTS map_annotations_geom_idx ON map_annotations USING GIST (geom);",
]

def apply_schema():
    conn = psycopg2.connect(**DB_CONFIG)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # Alter geom column type if needed
    cur.execute("ALTER TABLE IF EXISTS districts ALTER COLUMN geom TYPE GEOMETRY(Geometry, 4326);")

    for ddl in TABLES_DDL:
        cur.execute(ddl)

    conn.close()

def get_row_counts():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name != 'spatial_ref_sys'
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    
    counts = {}
    for t in tables:
        cur.execute(f'SELECT COUNT(*) FROM "{t}";')
        row = cur.fetchone()
        counts[t] = row[0]
    
    conn.close()
    return counts

if __name__ == "__main__":
    apply_schema()
    counts = get_row_counts()
    print("\n--- DHARA TABLE ROW COUNTS ---")
    for t, cnt in counts.items():
        print(f"  {t}: {cnt} rows")
