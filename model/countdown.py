"""
countdown.py
-------------
Converts a village's 7-day VRI trajectory into hours_until_cutoff — the
number the officer actually needs ("we have 46 hours"), not a score.

CUTOFF_THRESHOLD = 30. Below this VRI, a village is treated as
functionally cut off (reachability probability has dropped enough that
relying on the road is no longer a safe plan) — this is a judgement call,
not a physical constant, and should be confirmed with Neel alongside the
VRI weights sign-off.

Method: linear interpolation between the daily VRI points to estimate the
sub-day crossing time, since VRI is only computed once per day. If the
village never crosses the threshold within the forecast horizon,
hours_until_cutoff is reported as None ("no cutoff predicted in next N
days") rather than a fabricated number.
"""

import pandas as pd
import numpy as np

CUTOFF_THRESHOLD = 30.0


def compute_countdown(vri_df: pd.DataFrame, as_of_datetime=None) -> pd.DataFrame:
    vri_df = vri_df.copy()
    vri_df["date"] = pd.to_datetime(vri_df["date"])
    as_of_datetime = pd.to_datetime(as_of_datetime) if as_of_datetime else vri_df["date"].min() - pd.Timedelta(days=1)

    rows = []
    for village_id, g in vri_df.groupby("village_id"):
        g = g.sort_values("date").reset_index(drop=True)
        district = g["district"].iloc[0]
        current_vri = g["vri"].iloc[0]

        hours_until_cutoff = None
        crossing_date = None

        if current_vri < CUTOFF_THRESHOLD:
            hours_until_cutoff = 0.0
            crossing_date = as_of_datetime
        else:
            prev_vri, prev_date = current_vri, as_of_datetime
            for r in g.itertuples():
                if r.vri < CUTOFF_THRESHOLD:
                    # linear interpolation between prev point (above threshold)
                    # and this point (below threshold) to estimate crossing time
                    span_days = (r.date - prev_date).days or 1
                    frac = (prev_vri - CUTOFF_THRESHOLD) / (prev_vri - r.vri) if prev_vri != r.vri else 0
                    frac = np.clip(frac, 0, 1)
                    crossing_date = prev_date + pd.Timedelta(days=span_days * frac)
                    hours_until_cutoff = round((crossing_date - as_of_datetime).total_seconds() / 3600, 1)
                    break
                prev_vri, prev_date = r.vri, r.date

        rows.append({
            "village_id": village_id,
            "district": district,
            "current_vri": current_vri,
            "hours_until_cutoff": hours_until_cutoff,
            "predicted_cutoff_date": crossing_date.date() if crossing_date is not None else None,
            "status": (
                "cut_off_now" if current_vri < CUTOFF_THRESHOLD and hours_until_cutoff == 0.0
                else "cutoff_predicted" if hours_until_cutoff is not None
                else "no_cutoff_in_window"
            ),
        })
    return pd.DataFrame(rows).sort_values("hours_until_cutoff", na_position="last")


if __name__ == "__main__":
    vri_df = pd.read_csv("outputs/vri_7day.csv")
    countdown_df = compute_countdown(vri_df)
    countdown_df.to_csv("outputs/countdown.csv", index=False)
    print(countdown_df.to_string(index=False))
