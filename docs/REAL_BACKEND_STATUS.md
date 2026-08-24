# DHARA Real Backend Assessment & Status Report

> Generated: 2026-08-24 04:36 IST  
> Database Engine: PostgreSQL 16.4 (Debian 16.4-1.pgdg110+2) + PostGIS 3.4.3  
> Environment: Docker Container (`ner_db`) on `localhost:5433`

---

## 1. PostgreSQL & PostGIS Status

| Parameter | Configuration / Value |
|-----------|----------------------|
| **Host** | `localhost` |
| **Port** | `5433` (Docker container mapping: `5433:5432`) |
| **Container Name** | `ner_db` (Image: `postgis/postgis:16-3.4`) |
| **PostgreSQL Version** | **16.4** |
| **PostGIS Extension** | **3.4.3** (`POSTGIS="3.4.3 e365945"`) |
| **Database Name** | `dhara` |
| **Database User** | `ner` |
| **DATABASE_URL** | `postgresql://ner:ner_dev_password@localhost:5433/dhara` |

---

## 2. Source Datasets Audit

### Real Datasets Found in Workspace

| Dataset Category | Source File / Path | Status / Notes |
|------------------|-------------------|----------------|
| **Road Network (Placeholder)** | `routing/data/districts/hill_district.geojson` & `valley_district.geojson` | ⚠️ Contained placeholder IDs (`h_e_1`, `NH-Placeholder-1`). **Not verified real OpenStreetMap geometry**, so withheld from ingestion per strict real-data directive. |

### Missing Real Datasets

| Dataset | Expected Source | Status |
|---------|-----------------|--------|
| **OpenStreetMap Road Segments** | Live OSM PBF/OSMnx export for target North-East India corridors | ❌ **Missing** |
| **SRTM / Copernicus Slope Data** | DEM GeoTIFF (30m elevation & slope calculation) | ❌ **Missing** |
| **Open-Meteo Rainfall** | Historical/Forecast Precipitation API / CSV export | ❌ **Missing** |
| **NASA COOLR Landslide Events** | Global Landslide Catalog shapefile/GeoJSON | ❌ **Missing** |
| **GADM Boundaries** | Official state/district boundary GIS layer | ❌ **Missing** |
| **OSM Health Facilities** | Hospitals/PHC point locations | ❌ **Missing** |
| **Habitation Coordinates** | Pradhan Mantri Gram Sadak Yojana (PMGSY) / Census habitations | ❌ **Missing** |

> [!CAUTION]
> **No real external datasets exist in the current repository.** As directed, missing real datasets have NOT been replaced with synthetic data.

---

## 3. Database Schema & Actual Row Counts

The DHARA PostGIS schema was initialized via `db/migrate.py`. Every table includes a `data_provenance` field to explicitly demarcate data origins (`REAL`, `DERIVED`, or `SIMULATED`).

| Table Name | Category / Purpose | Provenance Tag | Actual Row Count |
|------------|-------------------|----------------|------------------|
| `districts` | District GIS boundaries | `REAL` | **0** |
| `habitations` | Village & habitation locations | `REAL` | **0** |
| `road_segments` | Road network & slope attributes | `REAL` | **0** |
| `weather_observations` | Historical & forecast rainfall | `REAL` | **0** |
| `landslide_events` | NASA COOLR landslide occurrences | `REAL` | **0** |
| `health_facilities` | Emergency medical facilities | `REAL` | **0** |
| `depots` | Relief material supply hubs | `SIMULATED` | **0** |
| `vri_forecasts` | Vulnerability & Reachability Index | `DERIVED` | **0** |
| `countdown_status` | Cutoff countdown timers | `DERIVED` | **0** |
| `egress_metrics` | Emergency evacuation egress times | `DERIVED` | **0** |
| `dispatch_decisions` | Pre-positioning & dispatch decisions | `DERIVED` | **0** |
| `audit_logs` | Governance reasoning & audit trails | `DERIVED` | **0** |
| `simulated_telemetry` | Vehicle positions & GPS telemetry | `SIMULATED` | **0** |

---

## 4. Provenance Summary

- **Real Datasets**: 0 rows imported (awaiting download/ingestion of genuine OSM, NASA COOLR, Open-Meteo, and SRTM files).
- **Derived Datasets**: 0 rows computed (will be produced by `model/` & `routing/` once real data is present).
- **Simulated Datasets**: 0 rows populated (reserved for vehicle GPS telemetry and depot stock).

---

## 5. Remaining Blockers

1. **Missing Real Datasets**: Real GIS files (OSM PBF for NE India, NASA COOLR CSV, Open-Meteo rainfall, SRTM DEM) must be downloaded or fetched via APIs into `data/real/`.
2. **Real Data Ingestion**: An ingestion module (`db/ingest_real_data.py`) must be executed to populate `districts`, `habitations`, `road_segments`, and `weather_observations` from the downloaded real datasets.
3. **Pipeline Execution on Real Data**: The model prediction pipeline (`model/closure_prediction.py` and `scripts/decision_pipeline.py`) must run on the real database tables to generate derived VRI forecasts and dispatch decisions.
4. **Fastify API Construction**: Build the Node.js Fastify API (`api/`) connected to `postgresql://ner:ner_dev_password@localhost:5433/dhara` *only after* real data is ingested.
