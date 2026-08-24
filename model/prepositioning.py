"""
prepositioning.py
-------------------
Pre-positioning engine (Option B: predict cutoffs first, then decide
shipments — see docs/vri_and_option_b_for_neel.md for the full rationale
sent to Neel).

Logic, in order:
  1. Take each village's hours_until_cutoff (from countdown.py).
  2. If a village will be cut off, estimate N = days it will likely stay
     cut off. We don't have a direct closure-duration model yet (noted as
     a limitation for Q&A), so N is estimated from the segment(s)'
     historical past_closures_14d + landslide/flood class as a proxy
     severity band (LOW/MED/HIGH -> 2/5/9 days). This is the one place in
     the pipeline using a heuristic instead of a learned model — flagged
     explicitly rather than dressed up as a prediction.
  3. required_units = population * per_capita_daily_need * N
  4. Pick the nearest depot with enough stock (simple nearest-feasible
     rule here; Molik's routing/dispatch layer does the real optimisation
     once this hands off).
  5. latest_departure_time = predicted_cutoff_datetime - travel_time_to_village
     i.e. the last moment a truck can still leave and beat the cutoff.

Output columns match the "Done =" spec: commodity, quantity, depot,
destination, latest departure time.
"""

import pandas as pd
from datetime import timedelta

PER_CAPITA_DAILY_NEED_UNITS = 0.6  # placeholder ration units/person/day; align with Shriti's denial-days unit table
DEPOT_TRUCK_SPEED_KMH = 30.0
SEVERITY_DAYS = {"LOW": 2, "MED": 5, "HIGH": 9}


def _severity_band(landslide_class, flood_class, past_closures_14d):
    hazard = max(landslide_class, flood_class)
    if hazard >= 3 or past_closures_14d >= 3:
        return "HIGH"
    if hazard >= 1 or past_closures_14d >= 1:
        return "MED"
    return "LOW"


def _estimated_closure_days(village_id, villages_df, segments_df, weather_closures_df):
    v = villages_df.set_index("village_id").loc[village_id]
    seg_ids = [s for s in (v.route_1 or []) + (v.route_2 or [])]
    if not seg_ids:
        return SEVERITY_DAYS["MED"]
    segs = segments_df[segments_df["segment_id"].isin(seg_ids)]
    latest = (weather_closures_df[weather_closures_df["segment_id"].isin(seg_ids)]
              .sort_values("date").groupby("segment_id").tail(1))
    worst_band = "LOW"
    for _, seg in segs.iterrows():
        pc = latest.loc[latest["segment_id"] == seg["segment_id"], "past_closures_14d"]
        pc_val = pc.iloc[0] if len(pc) else 0
        band = _severity_band(seg["landslide_class"], seg["flood_class"], pc_val)
        if SEVERITY_DAYS[band] > SEVERITY_DAYS[worst_band]:
            worst_band = band
    return SEVERITY_DAYS[worst_band]


def generate_dispatch_plan(countdown_df, villages_df, segments_df, weather_closures_df,
                            depots_df, commodity="rations", as_of_datetime=None):
    as_of_datetime = pd.to_datetime(as_of_datetime) if as_of_datetime else pd.Timestamp.now()
    at_risk = countdown_df[countdown_df["status"].isin(["cutoff_predicted", "cut_off_now"])].copy()

    depots_df = depots_df[depots_df["commodity"] == commodity].sort_values("stock_units", ascending=False).copy()
    remaining_stock = dict(zip(depots_df["depot_id"], depots_df["stock_units"]))

    villages_idx = villages_df.set_index("village_id")
    plans = []
    for r in at_risk.itertuples():
        v = villages_idx.loc[r.village_id]
        n_days = _estimated_closure_days(r.village_id, villages_df, segments_df, weather_closures_df)
        required_units = int(round(v.population * PER_CAPITA_DAILY_NEED_UNITS * n_days))

        # nearest feasible depot: prefer closer depot, but must have enough stock
        feasible = [(d, remaining_stock[d]) for d in remaining_stock if remaining_stock[d] >= required_units]
        chosen_depot = feasible[0][0] if feasible else max(remaining_stock, key=remaining_stock.get)
        shipped_units = min(required_units, remaining_stock.get(chosen_depot, 0))
        remaining_stock[chosen_depot] = remaining_stock.get(chosen_depot, 0) - shipped_units

        travel_hours = round(v.dist_to_depot_km / DEPOT_TRUCK_SPEED_KMH, 1)
        hours_left = r.hours_until_cutoff if pd.notna(r.hours_until_cutoff) else 0.0
        cutoff_dt = as_of_datetime + timedelta(hours=hours_left)
        latest_departure = cutoff_dt - timedelta(hours=travel_hours)

        plans.append({
            "village_id": r.village_id,
            "district": r.district,
            "commodity": commodity,
            "estimated_cutoff_duration_days": n_days,
            "population": v.population,
            "required_units": required_units,
            "depot": chosen_depot,
            "shipped_units": shipped_units,
            "shortfall_units": max(0, required_units - shipped_units),
            "predicted_cutoff_datetime": cutoff_dt,
            "travel_time_hours": travel_hours,
            "latest_departure_time": latest_departure,
            "departure_status": "FEASIBLE" if latest_departure > as_of_datetime else "AT_RISK_ALREADY_LATE",
        })
    return pd.DataFrame(plans).sort_values("latest_departure_time")


if __name__ == "__main__":
    segments = pd.read_csv("data/road_segments.csv")
    weather_closures = pd.read_csv("data/weather_closures.csv")
    villages = pd.read_pickle("data/villages.pkl")
    depots = pd.read_csv("data/depots.csv")
    countdown_df = pd.read_csv("outputs/countdown.csv")

    plan = generate_dispatch_plan(countdown_df, villages, segments, weather_closures, depots)
    plan.to_csv("outputs/dispatch_plan.csv", index=False)
    print(plan.to_string(index=False))
