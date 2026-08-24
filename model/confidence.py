"""
confidence.py
--------------
Confidence score for a district's closure predictions, based on how much
real historical data backs the model for that district — NOT on the
predicted probability itself. A 90% closure probability built on 3 years
of dense data deserves more trust than a 90% probability built on 12 rows.

confidence in [0, 1]:
  data_volume_score   -> more monsoon-days observed = more confidence
  recency_score       -> data from the last 1-2 monsoons weighs more
  coverage_score      -> fraction of segments in the district with any
                         closure history at all (a segment that has NEVER
                         closed in the record is not the same as a segment
                         we've never observed)

confidence = weighted average of the three, each normalised to [0, 1].
This score travels alongside closure_probability and VRI everywhere
downstream, so an officer (or a judge) can tell "confident 0.85" apart
from "0.85, but thin data."
"""

import pandas as pd
import numpy as np
from datetime import datetime

WEIGHTS = {"volume": 0.4, "recency": 0.35, "coverage": 0.25}
VOLUME_SATURATION_DAYS = 365 * 2  # confidence saturates around 2 monsoon-years of daily rows


def compute_district_confidence(weather_closures_df: pd.DataFrame, segments_df: pd.DataFrame,
                                  as_of_date=None) -> pd.DataFrame:
    df = weather_closures_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    as_of_date = pd.to_datetime(as_of_date) if as_of_date else df["date"].max()

    rows = []
    for district, seg_group in segments_df.groupby("district"):
        seg_ids = set(seg_group["segment_id"])
        d = df[df["segment_id"].isin(seg_ids)]

        n_days = d["date"].nunique()
        volume_score = min(n_days / VOLUME_SATURATION_DAYS, 1.0)

        days_since_last = (as_of_date - d["date"].max()).days if len(d) else 9999
        recency_score = max(0.0, 1.0 - days_since_last / 365)

        segs_with_history = d.groupby("segment_id").size()
        coverage_score = (segs_with_history >= 30).sum() / max(len(seg_ids), 1)  # >=30 obs = "has history"

        confidence = (
            WEIGHTS["volume"] * volume_score
            + WEIGHTS["recency"] * recency_score
            + WEIGHTS["coverage"] * coverage_score
        )
        rows.append({
            "district": district,
            "observed_days": n_days,
            "volume_score": round(volume_score, 3),
            "recency_score": round(recency_score, 3),
            "coverage_score": round(coverage_score, 3),
            "confidence": round(confidence, 3),
        })
    return pd.DataFrame(rows)


if __name__ == "__main__":
    segments = pd.read_csv("data/road_segments.csv")
    weather_closures = pd.read_csv("data/weather_closures.csv")
    conf = compute_district_confidence(weather_closures, segments)
    print(conf)
