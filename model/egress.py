"""
egress.py
----------
Emergency Egress: travel time to the nearest health facility, NOW vs. AFTER
the predicted closure. This is the number that turns "village is cut off"
into "a medical emergency in this village goes from 40 minutes away to
4.5 hours away," which is the framing that actually moves an officer.

Method:
  - travel_time_now: dist_to_health_facility_km / assumed road speed,
    using the village's best (least-cost) currently-open route.
  - travel_time_after_closure: recompute using ONLY the routes that survive
    past the predicted cutoff (i.e. exclude any route whose segments are
    predicted closed on/after predicted_cutoff_date). If NO route survives,
    egress is reported as "no_road_route" and a straight-line/foot-path
    fallback speed is used as a worst-case estimate, clearly labeled as such.

Speed assumptions (adjust per real terrain data when available):
  ROAD_SPEED_KMH = 30   (typical hill-district mixed road speed)
  FALLBACK_FOOT_SPEED_KMH = 4  (worst case, walking/foot-path only)
"""

import pandas as pd
from closure_prediction import predict_closure_probability
from vri import build_future_feature_rows, _route_reliability

ROAD_SPEED_KMH = 30.0
FALLBACK_FOOT_SPEED_KMH = 4.0
ROUTE_OPEN_THRESHOLD = 0.5  # route treated as "open" if reliability >= this


def compute_egress(segments_df, weather_closures_df, villages_df, countdown_df, as_of_date=None):
    weather_closures_df = weather_closures_df.copy()
    weather_closures_df["date"] = pd.to_datetime(weather_closures_df["date"])
    as_of_date = pd.to_datetime(as_of_date) if as_of_date else weather_closures_df["date"].max()

    countdown_lookup = countdown_df.set_index("village_id").to_dict("index")

    rows = []
    for v in villages_df.itertuples():
        cd = countdown_lookup.get(v.village_id, {})
        cutoff_date = cd.get("predicted_cutoff_date")
        dist_km = v.dist_to_health_facility_km

        # --- travel time NOW: assume current road network open (VRI already
        # reflects present risk; "now" egress uses direct road distance) ---
        travel_time_now_min = round((dist_km / ROAD_SPEED_KMH) * 60, 1)

        # --- travel time AFTER predicted closure ---
        if cutoff_date is None or (isinstance(cutoff_date, float) and pd.isna(cutoff_date)):
            travel_time_after_min = travel_time_now_min
            egress_mode_after = "road_unaffected"
        else:
            future_rows = build_future_feature_rows(
                segments_df, weather_closures_df, [pd.to_datetime(cutoff_date)]
            )
            proba_df = predict_closure_probability(future_rows)
            proba_lookup = dict(zip(proba_df["segment_id"], proba_df["closure_probability"]))

            routes = [r for r in [v.route_1, v.route_2] if r]
            any_route_open = any(
                _route_reliability(r, proba_lookup) >= ROUTE_OPEN_THRESHOLD for r in routes
            )
            if any_route_open:
                travel_time_after_min = travel_time_now_min  # a surviving route still uses road speed
                egress_mode_after = "alternate_route_road"
            else:
                travel_time_after_min = round((dist_km / FALLBACK_FOOT_SPEED_KMH) * 60, 1)
                egress_mode_after = "no_road_route_fallback_foot_path"

        rows.append({
            "village_id": v.village_id,
            "district": v.district,
            "dist_to_health_facility_km": dist_km,
            "travel_time_now_min": travel_time_now_min,
            "predicted_cutoff_date": cutoff_date,
            "travel_time_after_closure_min": travel_time_after_min,
            "egress_mode_after_closure": egress_mode_after,
            "egress_delta_min": round(travel_time_after_min - travel_time_now_min, 1),
        })
    return pd.DataFrame(rows).sort_values("egress_delta_min", ascending=False)


if __name__ == "__main__":
    segments = pd.read_csv("data/road_segments.csv")
    weather_closures = pd.read_csv("data/weather_closures.csv")
    villages = pd.read_pickle("data/villages.pkl")
    countdown_df = pd.read_csv("outputs/countdown.csv")

    egress_df = compute_egress(segments, weather_closures, villages, countdown_df)
    egress_df.to_csv("outputs/egress.csv", index=False)
    print(egress_df.to_string(index=False))
