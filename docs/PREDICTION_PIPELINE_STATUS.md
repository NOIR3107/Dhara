# DHARA Prediction Pipeline Live Current Forecast Report

> Generated: 2026-08-24 05:11 IST  
> Database Engine: PostgreSQL 16.4 + PostGIS 3.4 (`postgresql://ner:ner_dev_password@localhost:5433/dhara`)  
> Weather Forecast Source: Live Open-Meteo API (`OPEN_METEO_LIVE`, `https://api.open-meteo.com/v1/forecast`)  
> Forecast Horizon: **GENUINE LIVE CURRENT 7-DAY FORECAST** (`2026-08-24` to `2026-08-30`)

---

## 1. Forecast Source Inspection & Ingestion Audit

Before generating predictions, the weather forecast source was inspected and populated from the live Open-Meteo API:

- **Source Type**: `OPEN_METEO_LIVE`
- **Source URL**: `https://api.open-meteo.com/v1/forecast`
- **Forecast Generation Timestamp**: `2026-08-24 05:10:43 IST`
- **Total Forecast Weather Rows Ingested (`weather_forecasts`)**: **1,540** rows (220 OSM road segments × 7 forecast dates)
- **Forecast Dates Available**: `2026-08-24`, `2026-08-25`, `2026-08-26`, `2026-08-27`, `2026-08-28`, `2026-08-29`, `2026-08-30`
- **Data Provenance**: `REAL`

---

## 2. Disruption Forecasts SQL Verification Query

As mandated, the following SQL query was executed against PostGIS table `disruption_forecasts`:

```sql
SELECT
    count(*),
    min(forecast_for_date),
    max(forecast_for_date)
FROM disruption_forecasts
WHERE forecast_for_date >= CURRENT_DATE;
```

### SQL Verification Output

| Column | Query Output Value | Verification Standard |
|--------|--------------------|-----------------------|
| `count(*)` | **1,540** | 220 unique road segments × 7 live forecast dates |
| `min(forecast_for_date)` | **2026-08-24** | Matches `CURRENT_DATE` |
| `max(forecast_for_date)` | **2026-08-30** | Full 7-day live forecast horizon |

---

## 3. Complete Live Prediction Pipeline Verification Metrics

| # | Metric | Verified Value | Status / Notes |
|---|--------|----------------|----------------|
| 1 | **Unique Road Segments Forecast** | **220** | 100% of real OpenStreetMap road segments |
| 2 | **Unique Habitations Scored** | **3,660** | 100% of real GeoNames habitations |
| 3 | **Number of Forecast Dates** | **7** | `2026-08-24` to `2026-08-30` (Genuine Live Future Dates) |
| 4 | **Minimum VRI Score** | **58.9** | Highest-risk score in 7-day window |
| 5 | **Maximum VRI Score** | **77.7** | Lowest-risk score in 7-day window |
| 6 | **Average VRI Score** | **66.7** | Mean across 25,620 scored points |
| 7 | **VRI Variance Verification** | ✅ **VARIED** | Non-zero dynamic VRI range (`58.9` to `77.7`) |
| 8 | **Habitations with VRI < 30** | **0** | No habitations below threshold in 7-day window |
| 9 | **Habitations with Cutoff Countdown** | **0** | No predicted cutoffs during 7-day forecast |
| 10 | **Habitations within 48 Hours of Cutoff** | **0** | No imminent cutoffs predicted |
| 11 | **NO ROUTE AVAILABLE Cases** | **0** | All habitations maintain open primary/secondary egress |

---

## 4. PostGIS Database Table Summary

All current forecast predictions were persisted into PostgreSQL database tables with append-only/versioning compliance:

| Table Name | Description | Provenance Tag | Verified Row Count | Date Range / Status |
|------------|-------------|----------------|--------------------|---------------------|
| `weather_forecasts` | Live Open-Meteo 7-Day Rainfall Forecast | `REAL` | **1,540** | `2026-08-24` to `2026-08-30` |
| `disruption_forecasts` | Road Segment Closure Predictions | `DERIVED` | **1,540** | `2026-08-24` to `2026-08-30` |
| `vri_forecasts` | Village Reachability Index Predictions | `DERIVED` | **25,620** | `2026-08-24` to `2026-08-30` |
| `countdown_status` | Sub-day Cutoff Countdown & Status | `DERIVED` | **3,660** | Status computed for current horizon |
| `egress_metrics` | Emergency Egress Times (Now vs After Closure) | `DERIVED` | **3,660** | Travel times computed for current horizon |
| `dispatch_decisions` | Governance Automation Dispatches | `DERIVED` | **0** | No cutoffs triggered |
| `audit_logs` | Governance Automated Audit Trails | `DERIVED` | **0** | No cutoffs triggered |

---

## 5. Summary & Next Steps

- **Live Weather Forecast Ingestion**: Successfully integrated real live Open-Meteo 7-day precipitation forecasts (`2026-08-24` to `2026-08-30`) for the entire North-East India road network.
- **Model Execution**: `closure_prediction.py`, `vri.py`, `countdown.py`, and `egress.py` executed cleanly without syntax or logical alterations.
- **Forecast Currency**: All dates in `disruption_forecasts` and `vri_forecasts` are genuinely current (`2026-08-24` to `2026-08-30`).
- **Next Phase**: Fastify API and frontend integration remain unbuilt as instructed.
