"""
hazard_adjustment.py
--------------------
Post-model adjustment of road-segment closure probabilities using live hazard
events from `hazard_events` (see ingest/ingest_hazards.py).

Why a separate layer instead of new model features: the closure model is
trained on historical rows that have no earthquake / cyclone / fire columns,
so adding those features would only learn a zero weight. Instead these are
explicit, documented rules applied on the odds scale, and every adjustment is
stored with its plain-English reason (table `segment_hazard_flags`) so an
officer can see exactly why a probability moved.

    adjusted_odds = model_odds × multiplier      (multiplier capped at MAX_MULTIPLIER)

Rules (heuristics for decision support — tune with real closure records):
  1. Earthquake shaking. M ≥ 4.0 within the last 7 days, segment within the
     magnitude-dependent landslide envelope R(M) (approximate envelope after
     Keefer 1984, "Landslides caused by earthquakes"). Effect fades with
     distance and with time since the quake (3-day e-folding), and is halved
     on low-susceptibility segments (landslide_class < 2).
       m = 1 + 2 × (1 − d/R) × e^(−days/3) × susceptibility
  2. Cyclone wind buffer. Segment intersects a GDACS forecast wind-buffer
     polygon valid on that day: green ×1.5, orange ×2.0, red ×3.0.
  3. Active fire. FIRMS detection within 2 km in the prior 48 h: ×1.2
     (smoke / visibility / jhum burning near the road).
"""
import json
import math
from datetime import datetime, time, timedelta, timezone

import pandas as pd

MAX_MULTIPLIER = 5.0
QUAKE_MIN_MAG = 4.0
QUAKE_LOOKBACK_DAYS = 7
FIRE_RADIUS_M = 2000
FIRE_MULTIPLIER = 1.2
CONE_MULTIPLIER = {"cone_green": 1.5, "cone_orange": 2.0, "cone_red": 3.0}

# Approximate maximum epicentral distance (km) of disrupted landslides by
# magnitude, after Keefer (1984). Linearly interpolated between points.
KEEFER_ENVELOPE = [(4.0, 0), (4.5, 10), (5.0, 25), (5.5, 50), (6.0, 90),
                   (6.5, 150), (7.0, 220), (7.5, 300), (8.0, 400)]

IST = timezone(timedelta(hours=5, minutes=30))


def landslide_radius_km(mag):
    pts = KEEFER_ENVELOPE
    if mag <= pts[0][0]:
        return 0.0
    if mag >= pts[-1][0]:
        return float(pts[-1][1])
    for (m0, r0), (m1, r1) in zip(pts, pts[1:]):
        if m0 <= mag <= m1:
            return r0 + (r1 - r0) * (mag - m0) / (m1 - m0)
    return 0.0


def _day_bounds(d):
    """Start/end of an IST calendar day as aware datetimes."""
    d = pd.Timestamp(d).date()
    start = datetime.combine(d, time.min, tzinfo=IST)
    return start, start + timedelta(days=1)


def _load(conn, sql, params):
    cur = conn.cursor()
    cur.execute(sql, params)
    cols = [c[0] for c in cur.description]
    rows = cur.fetchall()
    cur.close()
    return pd.DataFrame(rows, columns=cols)


def _table_exists(conn, name):
    cur = conn.cursor()
    cur.execute("SELECT to_regclass(%s)", (name,))
    ok = cur.fetchone()[0] is not None
    cur.close()
    return ok


def compute_adjustments(conn, forecast_dates):
    """Return DataFrame[segment_id, date, multiplier, reasons(list[str])] for
    segment/date pairs that have at least one active hazard."""
    if not forecast_dates or not _table_exists(conn, "hazard_events"):
        return pd.DataFrame(columns=["segment_id", "date", "multiplier", "reasons"])

    first_start, _ = _day_bounds(min(forecast_dates))
    _, last_end = _day_bounds(max(forecast_dates))
    max_radius_m = landslide_radius_km(8.0) * 1000

    quakes = _load(conn, """
        SELECT s.segment_id, s.landslide_class, h.title, h.magnitude, h.event_time,
               ST_Distance(s.geom::geography, h.geom::geography) / 1000.0 AS km
        FROM road_segments s
        JOIN hazard_events h
          ON h.event_type = 'earthquake' AND h.magnitude >= %s
         AND h.event_time >= %s AND h.event_time < %s
         AND ST_DWithin(s.geom::geography, h.geom::geography, %s);
    """, (QUAKE_MIN_MAG, first_start - timedelta(days=QUAKE_LOOKBACK_DAYS), last_end, max_radius_m))

    cones = _load(conn, """
        SELECT s.segment_id, h.title, h.properties->>'part' AS part, h.event_time, h.valid_until
        FROM road_segments s
        JOIN hazard_events h
          ON h.event_type = 'cyclone' AND h.properties->>'part' LIKE 'cone_%%'
         AND h.valid_until >= %s AND h.event_time < %s
         AND ST_Intersects(s.geom, h.geom);
    """, (first_start, last_end))

    fires = _load(conn, """
        SELECT s.segment_id, h.event_time
        FROM road_segments s
        JOIN hazard_events h
          ON h.event_type = 'fire'
         AND h.event_time >= %s AND h.event_time < %s
         AND ST_DWithin(s.geom::geography, h.geom::geography, %s);
    """, (first_start - timedelta(days=2), last_end, FIRE_RADIUS_M))

    acc = {}  # (segment_id, date) -> [multiplier, reasons]

    def bump(seg, d, m, reason):
        entry = acc.setdefault((seg, d), [1.0, []])
        entry[0] *= m
        entry[1].append(f"{reason} (×{m:.2f})")

    for d in forecast_dates:
        day_start, day_end = _day_bounds(d)

        for q in quakes.itertuples():
            if q.event_time >= day_end:
                continue
            # Age of the quake at midday of the forecast day.
            days = max(0.0, (day_start + timedelta(hours=12) - q.event_time).total_seconds() / 86400)
            if days > QUAKE_LOOKBACK_DAYS:
                continue
            radius = landslide_radius_km(q.magnitude)
            if radius <= 0 or q.km >= radius:
                continue
            susceptibility = 1.0 if (q.landslide_class or 0) >= 2 else 0.5
            m = 1 + 2 * (1 - q.km / radius) * math.exp(-days / 3) * susceptibility
            if m >= 1.05:
                bump(q.segment_id, d, m,
                     f"{q.title}: {q.km:.0f} km away, {days:.1f} days ago, inside {radius:.0f} km landslide envelope")

        for seg, grp in cones.groupby("segment_id") if not cones.empty else []:
            active = grp[(grp["event_time"] < day_end) & (grp["valid_until"] >= day_start)]
            if active.empty:
                continue
            worst = max(active["part"], key=lambda p: CONE_MULTIPLIER.get(p, 1.0))
            name = active.iloc[0]["title"].split(" ")[:3]
            bump(seg, d, CONE_MULTIPLIER[worst],
                 f"Inside {worst.split('_')[1]} wind buffer of {' '.join(name)} (GDACS)")

        for seg, grp in fires.groupby("segment_id") if not fires.empty else []:
            recent = grp[(grp["event_time"] >= day_start - timedelta(days=2)) & (grp["event_time"] < day_end)]
            if not recent.empty:
                bump(seg, d, FIRE_MULTIPLIER, f"{len(recent)} active fire detection(s) within 2 km (FIRMS)")

    rows = [{"segment_id": seg, "date": pd.Timestamp(d), "multiplier": min(m, MAX_MULTIPLIER), "reasons": reasons}
            for (seg, d), (m, reasons) in acc.items()]
    return pd.DataFrame(rows, columns=["segment_id", "date", "multiplier", "reasons"])


def apply_adjustments(proba_df, adj_df):
    """Return a copy of proba_df with closure_probability adjusted plus
    base_probability / hazard_multiplier / hazard_reasons columns."""
    out = proba_df.copy()
    out["date"] = pd.to_datetime(out["date"])
    out["base_probability"] = out["closure_probability"]
    if adj_df.empty:
        out["hazard_multiplier"] = 1.0
        out["hazard_reasons"] = [[] for _ in range(len(out))]
        return out
    out = out.merge(adj_df, on=["segment_id", "date"], how="left")
    out["hazard_multiplier"] = out["multiplier"].fillna(1.0)
    out["hazard_reasons"] = out["reasons"].apply(lambda r: r if isinstance(r, list) else [])
    p = out["base_probability"].clip(1e-6, 1 - 1e-6)
    odds = p / (1 - p) * out["hazard_multiplier"]
    out["closure_probability"] = odds / (1 + odds)
    return out.drop(columns=["multiplier", "reasons"])


FLAGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS segment_hazard_flags (
    id SERIAL PRIMARY KEY,
    segment_id VARCHAR(100) NOT NULL,
    forecast_for_date DATE NOT NULL,
    base_probability FLOAT,
    adjusted_probability FLOAT,
    multiplier FLOAT,
    reasons JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_provenance VARCHAR(20) NOT NULL DEFAULT 'DERIVED'
);
"""


def write_flags(conn, adjusted_df):
    """Persist only the adjusted rows, append-only like disruption_forecasts."""
    from psycopg2.extras import execute_values
    cur = conn.cursor()
    cur.execute(FLAGS_SCHEMA)
    flagged = adjusted_df[adjusted_df["hazard_multiplier"] > 1.0]
    rows = [(r.segment_id, str(pd.Timestamp(r.date).date()), float(r.base_probability),
             float(r.closure_probability), float(r.hazard_multiplier), json.dumps(r.hazard_reasons), "DERIVED")
            for r in flagged.itertuples()]
    if rows:
        execute_values(cur, """
            INSERT INTO segment_hazard_flags (segment_id, forecast_for_date, base_probability,
                adjusted_probability, multiplier, reasons, data_provenance)
            VALUES %s;
        """, rows)
    cur.close()
    return len(rows)
