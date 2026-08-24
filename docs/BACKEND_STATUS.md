# DHARA Backend Status Report

> Generated: 2026-08-24 04:25 IST  
> Inspector: `db/inspect_db.py`

---

## Database Connection Status

| Item | Value |
|------|-------|
| **PostgreSQL Version** | 18.2 (x86_64-windows, MSVC 19.44, 64-bit) |
| **Service Name** | `postgresql-x64-18` |
| **Service Status** | Running |
| **Host** | `localhost:5432` |
| **Default User** | `postgres` (password: `postgres`) |
| **Python Driver** | `psycopg2` installed, `sqlalchemy` installed |
| **Node.js** | v24.19.0, npm 11.17.0 installed |
| **PostGIS** | **Not installed in any database** |

---

## Databases Available

| Database | Owner | DHARA-Related? | PostGIS? |
|----------|-------|----------------|----------|
| `careloop` | postgres | No (dental clinic SaaS) | No |
| `opdflow` | postgres | No (hospital OPD flow) | No |
| `postgres` | postgres | Empty default DB | No |
| `tathon` | postgres | No (clinic management) | No |

**CRITICAL: No `dhara` database exists.** There are zero DHARA-related tables anywhere in PostgreSQL. The existing databases (`careloop`, `opdflow`, `tathon`) belong to unrelated projects and must not be touched.

---

## Real Row Counts (Existing Databases - NOT DHARA)

These databases are **unrelated** to DHARA. Listed only to confirm inspection was thorough.

### `careloop` (Dental Clinic SaaS)
| Table | Rows |
|-------|------|
| `_prisma_migrations` | 1 |
| `appointments` | 4 |
| `audit_logs` | 1 |
| `automation_rules` | 4 |
| `campaign_recipients` | 0 |
| `campaigns` | 0 |
| `clinics` | 1 |
| `conversations` | 1 |
| `messages` | 3 |
| `patients` | 5 |
| `users` | 3 |

### `opdflow` (Hospital OPD)
| Table | Rows |
|-------|------|
| `appointments` | 0 |
| `doctors` | 0 |
| `patients` | 0 |

### `tathon` (Clinic Management)
| Table | Rows |
|-------|------|
| `appointments` | 4 |
| `audit_logs` | 1 |
| `automation_rules` | 4 |
| `campaign_recipients` | 0 |
| `campaigns` | 0 |
| `clinics` | 2 |
| `conversations` | 1 |
| `messages` | 3 |
| `patients` | 5 |
| `staff_invites` | 0 |
| `users` | 3 |

---

## Current DHARA Data Sources

| Data Source | Location | Format | Status |
|------------|----------|--------|--------|
| Road Segments | `data/road_segments.csv` | CSV (18 rows) | SIMULATED (synthetic_data.py) |
| Weather/Closures | `data/weather_closures.csv` | CSV (6,588 rows) | SIMULATED (3 monsoon seasons) |
| Villages | `data/villages.pkl` | Pickle (12 rows) | SIMULATED |
| Depots | `data/depots.csv` | CSV (2 rows) | SIMULATED |
| Dispatch Decisions | `outputs/dispatch_decisions.csv` | CSV (5 rows) | SIMULATED (pipeline output) |
| Trained Model | `models/closure_model.pkl` | Joblib pickle | Trained on simulated data |
| GeoJSON Roads | `routing/data/districts/*.geojson` | GeoJSON (2 files) | Placeholder |

**All current data is simulated.** There is no real IMD weather feed, no real road-segment GIS data, no real village census data, and no real depot inventory connected to this project. The entire pipeline currently runs on `synthetic_data.py` output.

---

## Which Data is Real vs. Simulated

| Component | Real / Simulated | Notes |
|-----------|-----------------|-------|
| ML Pipeline Logic | **Real** | `closure_prediction.py`, `vri.py`, `countdown.py`, `egress.py` - production-grade code |
| Routing Engine | **Real** | `routing.py`, `alternate_route.py`, `eta.py` - NetworkX-based, tested |
| Automation Governance | **Real** | `automation.py`, `reasoning.py` - 3-tier confidence rules |
| Decision Pipeline Adapter | **Real** | `scripts/decision_pipeline.py` - verified end-to-end |
| Road Segment Attributes | **Simulated** | 18 synthetic segments for "West_Hills" district |
| Weather & Closure History | **Simulated** | 3 monsoon seasons (Jun-Sep 2023/24/25) |
| Village Locations & Routes | **Simulated** | 12 placeholder habitations with synthetic coordinates |
| Depot Inventory | **Simulated** | 2 depots with placeholder stock |
| Vehicle Telemetry | **Not implemented** | No vehicle tracking exists |
| PostgreSQL Schema | **Does not exist** | No `dhara` database or tables created |
| PostGIS Spatial Data | **Not available** | PostGIS extension not installed |

---

## API Endpoints - Implementation Status

| Endpoint | Status | Blocker |
|----------|--------|---------|
| `GET /habitations` | Not implemented | No `dhara` database or schema |
| `GET /habitations/:id` | Not implemented | No `dhara` database or schema |
| `GET /forecast?date=` | Not implemented | No `dhara` database or schema |
| `GET /segments/at-risk` | Not implemented | No `dhara` database or schema |
| `GET /dispatches` | Not implemented | No `dhara` database or schema |
| `GET /alerts` | Not implemented | No `dhara` database or schema |
| `GET /coverage` | Not implemented | No `dhara` database or schema |
| `GET /audit` | Not implemented | No `dhara` database or schema |

---

## Remaining Blockers (Ordered by Priority)

### 1. DHARA Database Does Not Exist
No `dhara` database or schema exists in PostgreSQL. Before any API or frontend can read from PostgreSQL, the following must happen:

- **Create** `dhara` database
- **Install** PostGIS extension (`CREATE EXTENSION postgis;`)
- **Design and run** DDL migrations for DHARA tables:
  - `districts` (district metadata + boundary geometry)
  - `habitations` (village_id, name, population, coordinates as `geography(Point, 4326)`, routes)
  - `road_segments` (segment_id, district, road_type, slope, hazard classes, geometry)
  - `weather_observations` (segment_id, date, rainfall, forecast, closures)
  - `depots` (depot_id, location, stock, commodity)
  - `vri_forecasts` (village_id, date, vri, reachability_prob, confidence)
  - `countdown_status` (village_id, hours_until_cutoff, status)
  - `egress_metrics` (village_id, travel_time_now, travel_time_after, delta)
  - `dispatch_decisions` (village_id, depot, units, action, reasoning, timestamps)
  - `audit_log` (action, confidence, reasoning, timestamp)
- **Seed** initial data from existing CSV/PKL files into the new tables (one-time migration)

### 2. PostGIS Not Installed
PostGIS is required for spatial queries (GeoJSON responses, distance calculations, polygon containment). It is not currently installed in any database.

Action required:
```sql
-- After creating the dhara database:
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 3. No Python to PostgreSQL Writer
The prediction pipeline (`scripts/decision_pipeline.py`) currently writes only to CSV. A writer module is needed to push pipeline results into PostgreSQL after each run.

### 4. No Fastify API Layer
No `api/` directory or Node.js project exists. Fastify + TypeScript must be scaffolded from scratch.

### 5. No DATABASE_URL Configuration
No `.env` file or environment variable configuration exists for DHARA. A `DATABASE_URL` must be defined:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dhara
```

### 6. Frontend Still Reads from Python HTTP Server
The existing `web/` frontend reads from `web/server.py` which loads CSV/PKL files. This must be migrated to call the Fastify API endpoints instead.

---

## Recommended Next Steps

1. **Create `dhara` database** with PostGIS extension
2. **Design and apply DDL migrations** for all DHARA tables
3. **Build `db/seed_from_pipeline.py`** to load existing CSV/PKL data into PostgreSQL (one-time)
4. **Build `db/pipeline_writer.py`** so `decision_pipeline.py` writes results to PostgreSQL
5. **Scaffold `api/`** with Fastify + TypeScript + `pg` driver
6. **Implement API endpoints** reading from PostgreSQL
7. **Migrate frontend** to call Fastify instead of Python server

**WARNING:** Steps 1-4 must complete before any API endpoint can return real data. Without a `dhara` database, the Fastify API can only return empty results.
