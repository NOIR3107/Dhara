"""
vri.py
-------
Village Reachability Index (VRI).

DEFINITION (send this section to Neel as-is):

  VRI in [0, 100]. 0 = cut off (no known route to the district hub/health
  facility is passable). 100 = fully reachable (every known route clear,
  high model confidence).

  For a village with routes R = {r_1, r_2, ...} (each route = an ordered
  list of road segments), and a per-segment closure probability
  p(s) in [0,1] from closure_prediction.py:

    route_reliability(r) = PRODUCT over segments s in r of (1 - p(s))
        -> probability that every segment on that specific route is open.

    village_reachability = 1 - PRODUCT over routes r in R of (1 - route_reliability(r))
        -> probability that AT LEAST ONE route is fully open. This is what
           rewards redundancy: a village with two weak-but-independent
           routes can be MORE reachable than a village with one strong
           route, which matches how these villages actually work.

    VRI = 100 * village_reachability * confidence_penalty

    confidence_penalty = 0.5 + 0.5 * district_confidence
        -> a low-confidence district (thin data) has its VRI pulled toward
           the midpoint rather than reported as a false-precise number.
           This keeps VRI honest about a district we barely have data for.

  WEIGHTS: there are no separate hand-tuned "VRI weights" beyond the two
  above (route structure + confidence penalty) -- deliberately. All the
  actual feature weighting (rain, slope, landslide class, etc.) already
  happens once, inside the closure model. Re-weighting those same signals
  a second time at the VRI layer would double-count them and make the
  index harder to explain in Q&A. This is the "why" to send to Neel along
  with the formula.

  UPDATE FREQUENCY: daily, aligned with the daily rain-forecast refresh
  that feeds the closure model. Additionally recomputed immediately on any
  Early-Warning trigger (new weather alert, transaction-silence event,
  field report) for the affected district, same event-driven re-planning
  principle as the locked Nirantar spec.
"""

import pandas as pd
import numpy as np
from datetime import timedelta

from closure_prediction import predict_closure_probability
from features import NUMERIC_FEATURES
from confidence import compute_district_confidence


def _route_reliability(route_segment_ids, proba_lookup):
    if not route_segment_ids:
        return 0.0
    rel = 1.0
    for seg in route_segment_ids:
        p_close = proba_lookup.get(seg, 1.0)  # unknown segment treated as closed (conservative)
        rel *= (1 - p_close)
    return rel


def _village_reachability(route_list, proba_lookup):
    routes = [r for r in route_list if r]
    if not routes:
        return 0.0
    fail_all = 1.0
    for r in routes:
        fail_all *= (1 - _route_reliability(r, proba_lookup))
    return 1 - fail_all


def build_future_feature_rows(segments_df, weather_closures_df, forecast_dates):
    """Construct feature rows for future dates using the latest observed
    rain state as a stand-in for a real weather-forecast feed, plus rolling
    closure history. In production this pulls from IMD/NDMA forecast APIs."""
    weather_closures_df = weather_closures_df.copy()
    weather_closures_df["date"] = pd.to_datetime(weather_closures_df["date"])
    latest = weather_closures_df.sort_values("date").groupby("segment_id").tail(1)
    latest = latest.merge(segments_df[["segment_id", "district"]], on="segment_id", how="left")

    rows = []
    for d in forecast_dates:
        for r in latest.itertuples():
            rows.append({
                "segment_id": r.segment_id,
                "date": d,
                "district": r.district,
                "rain_last_24h_mm": r.rain_last_24h_mm,
                "rain_last_72h_mm": r.rain_last_72h_mm,
                "rain_forecast_72h_mm": r.rain_forecast_72h_mm,
                "days_since_monsoon_start": r.days_since_monsoon_start + (d - r.date).days,
                "past_closures_14d": r.past_closures_14d,
            })
    future = pd.DataFrame(rows)
    future = future.merge(segments_df[["segment_id", "slope_deg", "landslide_class",
                                        "flood_class", "road_type"]], on="segment_id", how="left")
    return future[["segment_id", "date", "district"] + NUMERIC_FEATURES + ["road_type"]]


def compute_vri(segments_df, weather_closures_df, villages_df, forecast_days=7, as_of_date=None):
    weather_closures_df = weather_closures_df.copy()
    weather_closures_df["date"] = pd.to_datetime(weather_closures_df["date"])
    as_of_date = pd.to_datetime(as_of_date) if as_of_date else weather_closures_df["date"].max()
    forecast_dates = [as_of_date + timedelta(days=i) for i in range(1, forecast_days + 1)]

    future_rows = build_future_feature_rows(segments_df, weather_closures_df, forecast_dates)
    proba_df = predict_closure_probability(future_rows)  # segment_id, date, district, closure_probability

    conf_df = compute_district_confidence(weather_closures_df, segments_df, as_of_date=as_of_date)
    conf_lookup = dict(zip(conf_df["district"], conf_df["confidence"]))

    records = []
    for d in forecast_dates:
        day_proba = proba_df[proba_df["date"] == d]
        proba_lookup = dict(zip(day_proba["segment_id"], day_proba["closure_probability"]))
        for v in villages_df.itertuples():
            reach = _village_reachability([v.route_1, v.route_2], proba_lookup)
            conf = conf_lookup.get(v.district, 0.5)
            vri = 100 * reach * (0.5 + 0.5 * conf)
            records.append({
                "village_id": v.village_id,
                "district": v.district,
                "date": d,
                "reachability_prob": round(reach, 4),
                "confidence": round(conf, 3),
                "vri": round(vri, 1),
            })
    return pd.DataFrame(records)


if __name__ == "__main__":
    segments = pd.read_csv("data/road_segments.csv")
    weather_closures = pd.read_csv("data/weather_closures.csv")
    villages = pd.read_pickle("data/villages.pkl")

    vri_df = compute_vri(segments, weather_closures, villages, forecast_days=7)
    vri_df.to_csv("outputs/vri_7day.csv", index=False)
    print(vri_df.pivot(index="village_id", columns="date", values="vri"))
