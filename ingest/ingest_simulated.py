"""
Ingest Depot Stock & Vehicle GPS Telemetry into PostGIS database 'dhara'
Source: Simulated Vehicle Telemetry Generator
Tables: depots, simulated_telemetry
Provenance: SIMULATED
"""
import sys
import os
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

DEPOTS = [
    {"id": "depot_tezpur", "name": "Tezpur Regional Relief Hub", "lat": 26.63, "lon": 92.80, "ration_packs": 1500, "med_kits": 400},
    {"id": "depot_dimapur", "name": "Dimapur Supply Depot",       "lat": 25.91, "lon": 93.73, "ration_packs": 1200, "med_kits": 350},
    {"id": "depot_siliguri","name": "Siliguri Northern Hub",     "lat": 26.72, "lon": 88.43, "ration_packs": 2000, "med_kits": 600},
]

VEHICLES = [
    {"vehicle_id": "v_tez_01", "depot_id": "depot_tezpur", "lat": 26.85, "lon": 92.65, "speed": 35.0, "status": "IN_TRANSIT"},
    {"vehicle_id": "v_tez_02", "depot_id": "depot_tezpur", "lat": 26.63, "lon": 92.80, "speed": 0.0,  "status": "IDLE"},
    {"vehicle_id": "v_dim_01", "depot_id": "depot_dimapur", "lat": 25.85, "lon": 94.05, "speed": 28.0, "status": "DISPATCHED"},
    {"vehicle_id": "v_sil_01", "depot_id": "depot_siliguri","lat": 26.90, "lon": 88.55, "speed": 40.0, "status": "IN_TRANSIT"},
]

def ingest_simulated():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    cur.execute("TRUNCATE TABLE depots RESTART IDENTITY CASCADE;")
    cur.execute("TRUNCATE TABLE simulated_telemetry RESTART IDENTITY CASCADE;")

    depot_count = 0
    for d in DEPOTS:
        cur.execute("""
            INSERT INTO depots (id, name, location, stock_ration_packs, stock_med_kits, data_provenance)
            VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s, %s, 'SIMULATED')
            ON CONFLICT (id) DO NOTHING;
        """, (d["id"], d["name"], d["lon"], d["lat"], d["ration_packs"], d["med_kits"]))
        depot_count += 1

    veh_count = 0
    for v in VEHICLES:
        cur.execute("""
            INSERT INTO simulated_telemetry (vehicle_id, depot_id, location, speed_kmh, status, data_provenance)
            VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s, %s, 'SIMULATED')
            ON CONFLICT (vehicle_id) DO NOTHING;
        """, (v["vehicle_id"], v["depot_id"], v["lon"], v["lat"], v["speed"], v["status"]))
        veh_count += 1

    conn.commit()
    conn.close()

    print(f"Simulated Generator → depots → {depot_count} → SIMULATED → SUCCESS", flush=True)
    print(f"Simulated Generator → simulated_telemetry → {veh_count} → SIMULATED → SUCCESS", flush=True)

if __name__ == "__main__":
    ingest_simulated()
