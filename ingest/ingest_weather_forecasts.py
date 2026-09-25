"""
Ingest Live Open-Meteo 7-Day Rainfall Forecast into PostGIS database 'dhara'
Source: Open-Meteo Live Forecast API (https://api.open-meteo.com/v1/forecast)
Table: weather_forecasts
Provenance: REAL
Source Type: OPEN_METEO_LIVE

Each road segment gets the forecast for its own location: segment centroids
are snapped to a ~5 km grid (0.05°, finer than Open-Meteo's model grids) and
all distinct cells are fetched in one multi-location request. Previously a
single Tawang point was copied to every segment with a synthetic variation
factor, which was not REAL data.

Also stores, per segment and date:
  rain_72h_mm       — rain over that day and the 2 days before it, using
                      Open-Meteo's recent past days for the first dates
  rain_next_72h_mm  — forecast rain over the following 3 days
"""
import sys
import os
import psycopg2
import psycopg2.extras
from datetime import datetime

sys.path.append(os.path.dirname(__file__))
from http_util import fetch_json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "dhara",
    "user": "ner",
    "password": "ner_dev_password"
}

GRID_DEG = 0.05
PAST_DAYS = 2      # enough history for a 72h window on the first forecast day
FORECAST_DAYS = 7


def get_segment_cells():
    """Return {segment_id: (lat, lon)} with coordinates snapped to the grid."""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("""
        SELECT segment_id, ST_Y(ST_PointOnSurface(geom)), ST_X(ST_PointOnSurface(geom))
        FROM road_segments WHERE geom IS NOT NULL;
    """)
    cells = {}
    for seg_id, lat, lon in cur.fetchall():
        cells[seg_id] = (round(round(lat / GRID_DEG) * GRID_DEG, 3),
                         round(round(lon / GRID_DEG) * GRID_DEG, 3))
    conn.close()
    return cells


def ensure_columns(cur):
    cur.execute("ALTER TABLE weather_forecasts ADD COLUMN IF NOT EXISTS rain_72h_mm FLOAT;")
    cur.execute("ALTER TABLE weather_forecasts ADD COLUMN IF NOT EXISTS rain_next_72h_mm FLOAT;")


def fetch_live_open_meteo_forecast(points):
    """points: list of (lat, lon). Returns {(lat, lon): [(date, mm), ...]} incl. past days."""
    lats = ",".join(str(p[0]) for p in points)
    lons = ",".join(str(p[1]) for p in points)
    url = ("https://api.open-meteo.com/v1/forecast"
           f"?latitude={lats}&longitude={lons}"
           f"&daily=precipitation_sum&past_days={PAST_DAYS}&forecast_days={FORECAST_DAYS}"
           "&timezone=Asia%2FKolkata")
    data = fetch_json(url, ttl_seconds=1800)
    if isinstance(data, dict):  # single location returns an object, not a list
        data = [data]
    series = {}
    for point, loc in zip(points, data):
        dates = loc["daily"]["time"]
        precip = [float(v) if v is not None else 0.0 for v in loc["daily"]["precipitation_sum"]]
        series[point] = list(zip(dates, precip))
    return series


def ingest_live_forecasts():
    seg_cells = get_segment_cells()
    points = sorted(set(seg_cells.values()))
    series = fetch_live_open_meteo_forecast(points)

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    ensure_columns(cur)

    # We clear weather_forecasts to insert fresh live forecast run
    cur.execute("TRUNCATE TABLE weather_forecasts RESTART IDENTITY;")

    now_timestamp = datetime.now()
    rows_to_insert = []
    for seg_id, cell in seg_cells.items():
        days = series[cell]
        values = [mm for _, mm in days]
        for i in range(PAST_DAYS, len(days)):
            f_date, mm = days[i]
            rain_72h = sum(values[max(0, i - 2):i + 1])
            rain_next_72h = sum(values[i + 1:i + 4])
            rows_to_insert.append((
                seg_id, f_date, round(mm, 1), round(rain_72h, 1), round(rain_next_72h, 1),
                'OPEN_METEO_LIVE', now_timestamp, 'REAL'
            ))

    psycopg2.extras.execute_values(cur, """
        INSERT INTO weather_forecasts (segment_id, forecast_date, rainfall_mm, rain_72h_mm, rain_next_72h_mm,
                                       source_type, generated_at, data_provenance)
        VALUES %s;
    """, rows_to_insert, page_size=5000)

    conn.commit()
    conn.close()

    all_dates = sorted({r[1] for r in rows_to_insert})
    print(f"Open-Meteo Live API → weather_forecasts → {len(rows_to_insert)} rows "
          f"({len(seg_cells)} segments, {len(points)} grid cells, {all_dates[0]} to {all_dates[-1]}) "
          f"→ OPEN_METEO_LIVE → REAL → SUCCESS", flush=True)
    return len(rows_to_insert)


if __name__ == "__main__":
    ingest_live_forecasts()
