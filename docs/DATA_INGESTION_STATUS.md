# DHARA Real Data Ingestion Status Report

> Generated: 2026-08-24 04:53 IST  
> Database: PostgreSQL 16.4 + PostGIS 3.4 (`postgresql://ner:ner_dev_password@localhost:5433/dhara`)  
> Environment: Localhost Port 5433 (Docker Container `ner_db`)

---

## 1. Ingestion Execution Summary

All required real datasets were downloaded from official public open-data APIs/repositories and ingested into the DHARA PostGIS database without inventing or fabricating records.

| Ingestion Step | Source Dataset | Target Table | Row Count | Data Provenance | Status |
|----------------|----------------|--------------|-----------|-----------------|--------|
| **1. Administrative Boundaries** | GADM / GeoBoundaries Level 2 | `districts` | **735** | `REAL` | ✅ **SUCCESS** |
| **2. Habitations & Villages** | GeoNames India (`IN.zip`) | `habitations` | **3,660** | `REAL` | ✅ **SUCCESS** |
| **3. Road Network & Slope** | OpenStreetMap (Overpass) + SRTM | `road_segments` | **220** | `REAL` | ✅ **SUCCESS** |
| **4. Historical & Forecast Rainfall** | Open-Meteo Precipitation API | `weather_observations` | **610** | `REAL` | ✅ **SUCCESS** |
| **5. Landslide Hazard Events** | NASA Global Landslide Catalog (COOLR via HDX) | `landslide_events` | **1,265** | `REAL` | ✅ **SUCCESS** |
| **6. Emergency Health Infrastructure** | OpenStreetMap Hospitals & Clinics | `health_facilities` | **4,058** | `REAL` | ✅ **SUCCESS** |
| **7. Relief Depot Stock** | Synthetic Relief Hub Generator | `depots` | **3** | `SIMULATED` | ✅ **SUCCESS** |
| **8. Vehicle GPS Telemetry** | Synthetic Vehicle Tracker Generator | `simulated_telemetry` | **4** | `SIMULATED` | ✅ **SUCCESS** |

---

## 2. Complete Database Verification Audit

Below is the verified record count for every table in the `dhara` PostGIS database:

| Table Name | Description | Provenance Tag | Verified Row Count |
|------------|-------------|----------------|--------------------|
| `districts` | Official India District Boundaries (Polygons) | `REAL` | **735** |
| `habitations` | Populated Habitations in North-East India | `REAL` | **3,660** |
| `road_segments` | OSM Road Corridors & SRTM Slope Attributes | `REAL` | **220** |
| `weather_observations` | Daily Rainfall Records (Open-Meteo API) | `REAL` | **610** |
| `landslide_events` | Historical NASA COOLR Landslide Incidents | `REAL` | **1,265** |
| `health_facilities` | Hospitals, Clinics & PHC Facilities (OSM) | `REAL` | **4,058** |
| `depots` | Relief Stock Depots | `SIMULATED` | **3** |
| `simulated_telemetry` | Vehicle Live GPS Positions | `SIMULATED` | **4** |
| `vri_forecasts` | Risk & Reachability Index | `DERIVED` | **0** *(Awaiting Pipeline Run)* |
| `countdown_status` | Cutoff Countdown Timers | `DERIVED` | **0** *(Awaiting Pipeline Run)* |
| `egress_metrics` | Emergency Evacuation Times | `DERIVED` | **0** *(Awaiting Pipeline Run)* |
| `dispatch_decisions` | Governance Pre-positioning Dispatches | `DERIVED` | **0** *(Awaiting Pipeline Run)* |
| `audit_logs` | Governance Reasoning Logs | `DERIVED` | **0** *(Awaiting Pipeline Run)* |

---

## 3. Provenance & Compliance Verification

- **Real Source Datasets**: **10,548 total real records** ingested across `districts`, `habitations`, `road_segments`, `weather_observations`, `landslide_events`, and `health_facilities`.
- **Simulated Records**: **7 total simulated records** (`depots` and `simulated_telemetry`), strictly tagged with `data_provenance = 'SIMULATED'`.
- **Derived Records**: Reserved for pipeline outputs (`vri_forecasts`, `dispatch_decisions`, `audit_logs`).
- **No Fabricated Data**: Zero placeholder rows or synthetic records were substituted for real tables.
- **Idempotency**: All ingestion modules (`ingest/*.py`) support clean re-runs (`TRUNCATE` / `ON CONFLICT DO NOTHING`).
