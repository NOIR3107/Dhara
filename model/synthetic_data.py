"""
synthetic_data.py
------------------
Generates a synthetic but structurally realistic NER dataset so the whole
prediction pipeline (features -> closure model -> VRI -> countdown -> egress
-> pre-positioning -> backtest) runs end-to-end before real feeds from
Akshita's DB are wired in.

Mirrors one hypothetical NER district ("Distcode: WH" = "West Hills", stand-in
for a real district) with:
  - a road-segment graph connecting villages to a district hub / health
    facility / depot
  - 3 monsoon seasons of daily weather + closure history per segment
  - villages with population + connecting routes (each route = ordered list
    of segment IDs)
  - depots with stock

Swap-in note: when Akshita's DB is ready, replace the four `generate_*`
functions below with real loaders that return the SAME column schemas.
Everything downstream (features.py onward) only depends on these schemas,
not on how the frames were produced.
"""

import numpy as np
import pandas as pd
from datetime import date, timedelta

RNG = np.random.default_rng(42)

DISTRICT = "West_Hills"  # stand-in NER district code
N_SEGMENTS = 18
N_VILLAGES = 12
MONSOON_YEARS = [2023, 2024, 2025]
MONSOON_START_MONTH = 6   # June
MONSOON_END_MONTH = 9     # Sept


def _monsoon_date_range(year):
    start = date(year, MONSOON_START_MONTH, 1)
    end = date(year, MONSOON_END_MONTH, 30)
    days = (end - start).days + 1
    return [start + timedelta(days=i) for i in range(days)]


def generate_road_segments():
    """Static attributes of each road segment (does not change daily)."""
    road_types = RNG.choice(
        ["state_highway", "district_road", "village_road"],
        size=N_SEGMENTS, p=[0.2, 0.35, 0.45]
    )
    slope = np.clip(RNG.normal(loc=18, scale=10, size=N_SEGMENTS), 1, 45)
    landslide_class = RNG.choice([0, 1, 2, 3], size=N_SEGMENTS, p=[0.35, 0.3, 0.2, 0.15])
    flood_class = RNG.choice([0, 1, 2, 3], size=N_SEGMENTS, p=[0.4, 0.3, 0.2, 0.1])

    df = pd.DataFrame({
        "segment_id": [f"SEG_{i:02d}" for i in range(N_SEGMENTS)],
        "district": DISTRICT,
        "road_type": road_types,
        "slope_deg": slope.round(1),
        "landslide_class": landslide_class,   # 0=none .. 3=high hazard (govt hazard zonation style)
        "flood_class": flood_class,           # 0=none .. 3=high hazard
        "length_km": RNG.uniform(2, 14, N_SEGMENTS).round(1),
    })
    return df


def generate_weather_and_closures(segments_df):
    """Daily rain + closure label per segment, across 3 monsoon seasons.
    Closure probability increases with slope, hazard class, and heavy rain,
    with a realistic class imbalance (closures are rare events)."""
    rows = []
    for year in MONSOON_YEARS:
        for seg in segments_df.itertuples():
            days = _monsoon_date_range(year)
            # segment-specific rain regime
            base_rain = RNG.uniform(5, 25)
            rain_series = np.clip(RNG.gamma(shape=2.0, scale=base_rain / 2, size=len(days)), 0, 300)
            days_since_monsoon = np.arange(len(days))

            open_state = True
            closed_streak = 0
            for i, d in enumerate(days):
                rain_today = rain_series[i]
                rain_72h = rain_series[max(0, i - 2):i + 1].sum()
                rain_fore_72h = rain_series[i + 1:i + 4].sum() if i + 4 <= len(days) else rain_72h

                hazard_score = (
                    0.03 * seg.slope_deg
                    + 0.7 * seg.landslide_class
                    + 0.6 * seg.flood_class
                    + 0.015 * rain_72h
                    + 0.01 * rain_today
                )
                # forced-reopen after a streak (roads do get cleared)
                if not open_state and closed_streak >= RNG.integers(1, 5):
                    open_state = True
                    closed_streak = 0

                p_close = 1 / (1 + np.exp(-(hazard_score - 6.0)))  # logistic squash
                closes_today = (RNG.random() < p_close) and open_state
                if closes_today:
                    open_state = False
                if not open_state:
                    closed_streak += 1

                rows.append({
                    "segment_id": seg.segment_id,
                    "date": d,
                    "rain_last_24h_mm": round(float(rain_today), 1),
                    "rain_last_72h_mm": round(float(rain_72h), 1),
                    "rain_forecast_72h_mm": round(float(rain_fore_72h), 1),
                    "days_since_monsoon_start": int(days_since_monsoon[i]),
                    "closed": int(not open_state),
                })
    df = pd.DataFrame(rows)
    # past_closures = rolling count of closures in prior 14 days, per segment
    df = df.sort_values(["segment_id", "date"])
    df["past_closures_14d"] = (
        df.groupby("segment_id")["closed"]
        .transform(lambda s: s.shift(1).rolling(14, min_periods=1).sum())
        .fillna(0)
    )
    return df.reset_index(drop=True)


def generate_villages_and_routes(segments_df):
    """Each village connects to the district hub via 1-2 routes (ordered
    lists of segment_ids). Some villages have a redundant second route."""
    seg_ids = segments_df["segment_id"].tolist()
    villages = []
    for i in range(N_VILLAGES):
        vid = f"VIL_{i:02d}"
        route_len = RNG.integers(1, 4)
        route1 = list(RNG.choice(seg_ids, size=route_len, replace=False))
        has_redundant = RNG.random() < 0.4
        route2 = list(RNG.choice(seg_ids, size=RNG.integers(1, 3), replace=False)) if has_redundant else None
        villages.append({
            "village_id": vid,
            "district": DISTRICT,
            "population": int(RNG.integers(150, 4000)),
            "route_1": route1,
            "route_2": route2,
            "dist_to_health_facility_km": round(float(RNG.uniform(3, 45)), 1),
            "dist_to_depot_km": round(float(RNG.uniform(5, 60)), 1),
        })
    return pd.DataFrame(villages)


def generate_depots():
    return pd.DataFrame([
        {"depot_id": "DEPOT_A", "district": DISTRICT, "stock_units": 12000, "commodity": "rations"},
        {"depot_id": "DEPOT_B", "district": DISTRICT, "stock_units": 7000, "commodity": "rations"},
    ])


def build_all(out_dir="data"):
    import os
    os.makedirs(out_dir, exist_ok=True)
    segments = generate_road_segments()
    weather_closures = generate_weather_and_closures(segments)
    villages = generate_villages_and_routes(segments)
    depots = generate_depots()

    segments.to_csv(f"{out_dir}/road_segments.csv", index=False)
    weather_closures.to_csv(f"{out_dir}/weather_closures.csv", index=False)
    villages.to_pickle(f"{out_dir}/villages.pkl")  # pickle: route cols are lists
    depots.to_csv(f"{out_dir}/depots.csv", index=False)

    print(f"segments: {segments.shape}, weather_closures: {weather_closures.shape}, "
          f"villages: {villages.shape}, depots: {depots.shape}")
    print(f"closure rate: {weather_closures['closed'].mean():.3%}")
    return segments, weather_closures, villages, depots


if __name__ == "__main__":
    build_all()
