"""
features.py
------------
Builds the road-segment feature table used by closure_prediction.py.

The 9 features (know these cold for Q&A):
  1. rain_last_24h_mm
  2. rain_last_72h_mm
  3. rain_forecast_72h_mm
  4. slope_deg
  5. landslide_class
  6. flood_class
  7. road_type
  8. past_closures_14d
  9. days_since_monsoon_start
Plus: date, segment_id, district (identifiers, not model features)
Label: closed (0/1)

Swap-in note: this function only assumes `segments_df` (static attributes)
and `weather_closures_df` (daily rows) exist with the column names produced
by synthetic_data.py. Point those two loaders at Akshita's DB later and
nothing else in this file changes.
"""

import pandas as pd


CATEGORICAL_FEATURES = ["road_type"]
NUMERIC_FEATURES = [
    "rain_last_24h_mm", "rain_last_72h_mm", "rain_forecast_72h_mm",
    "slope_deg", "landslide_class", "flood_class",
    "past_closures_14d", "days_since_monsoon_start",
]
LABEL = "closed"
ID_COLS = ["segment_id", "date", "district"]


def build_feature_table(segments_df: pd.DataFrame, weather_closures_df: pd.DataFrame) -> pd.DataFrame:
    df = weather_closures_df.merge(
        segments_df.drop(columns=["district"]) if "district" in segments_df.columns else segments_df,
        on="segment_id", how="left"
    )
    if "district" not in df.columns:
        df["district"] = segments_df["district"].iloc[0]

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["segment_id", "date"]).reset_index(drop=True)

    keep_cols = ID_COLS + NUMERIC_FEATURES + CATEGORICAL_FEATURES + [LABEL]
    return df[keep_cols]


def encode_for_model(feature_table: pd.DataFrame):
    """One-hot encode categoricals, return (X, y, feature_names, meta)."""
    meta = feature_table[ID_COLS].copy()
    y = feature_table[LABEL].astype(int)
    X = pd.get_dummies(
        feature_table[NUMERIC_FEATURES + CATEGORICAL_FEATURES],
        columns=CATEGORICAL_FEATURES, drop_first=False
    )
    return X, y, list(X.columns), meta


if __name__ == "__main__":
    segments = pd.read_csv("data/road_segments.csv")
    weather_closures = pd.read_csv("data/weather_closures.csv")
    ft = build_feature_table(segments, weather_closures)
    ft.to_csv("data/feature_table.csv", index=False)
    print(ft.head())
    print(f"\nShape: {ft.shape}")
    print(f"Closure rate: {ft[LABEL].mean():.3%}")
