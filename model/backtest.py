"""
backtest.py
------------
Real backtest: pick one actual monsoon road closure from the held-out 2025
test data, and show the day-by-day predicted closure probability for the
segment in the days leading up to it — proving (or honestly disproving)
that the model would have flagged it before it happened.

Method (kept deliberately simple and auditable — this is the slide judges
will scrutinise most):
  1. Find a segment/date where closed == 1 in the test set, and where the
     PRIOR day was closed == 0 (i.e. the actual moment of closure, not a
     day already inside a closed streak).
  2. Look at that segment's predicted closure_probability for each of the
     7 days before the event, using the deployed model from
     closure_prediction.py (trained only on 2023-2024, never seeing 2025).
  3. Report the first day the probability crosses the deployed decision
     threshold -> "flagged N days before the closure was recorded."
  4. If the model never crosses threshold before the event, we say so —
     the backtest is only credible if it can fail honestly.

This mirrors the exact narrative structure of the locked Nirantar spec's
Section 7 and the NER doc's Section 9, applied to real (here: synthetic,
standing in for real) transaction/weather data rather than a claim.
"""

import pandas as pd
import joblib

from features import build_feature_table, encode_for_model


def find_closure_event(feature_table: pd.DataFrame, test_year=2025):
    ft = feature_table.copy()
    ft["date"] = pd.to_datetime(ft["date"])
    ft = ft.sort_values(["segment_id", "date"])
    ft["prev_closed"] = ft.groupby("segment_id")["closed"].shift(1)
    events = ft[(ft["date"].dt.year == test_year) & (ft["closed"] == 1) & (ft["prev_closed"] == 0)]
    if events.empty:
        raise ValueError("No clean closure-onset event found in test year.")
    # pick the event with the longest lead-in history available (not near season start)
    events = events.assign(days_into_season=events["days_since_monsoon_start"])
    return events.sort_values("days_into_season", ascending=False).iloc[0]


def run_backtest():
    segments = pd.read_csv("data/road_segments.csv")
    weather_closures = pd.read_csv("data/weather_closures.csv")
    ft = build_feature_table(segments, weather_closures)

    event = find_closure_event(ft)
    seg_id, event_date = event["segment_id"], pd.to_datetime(event["date"])
    print(f"Backtest target: segment {seg_id}, closure recorded on {event_date.date()}\n")

    bundle = joblib.load("models/closure_model.pkl")
    model, cols, threshold = bundle["model"], bundle["feature_columns"], bundle["threshold"]

    window = ft[(ft["segment_id"] == seg_id) &
                (pd.to_datetime(ft["date"]) >= event_date - pd.Timedelta(days=7)) &
                (pd.to_datetime(ft["date"]) <= event_date)].copy()
    window = window.sort_values("date")

    X, y, _, meta = encode_for_model(window)
    X = X.reindex(columns=cols, fill_value=0)
    proba = model.predict_proba(X)[:, 1]
    window["predicted_closure_probability"] = proba
    window["flagged"] = window["predicted_closure_probability"] >= threshold

    print(window[["date", "closed", "predicted_closure_probability", "flagged"]].to_string(index=False))

    flagged_rows = window[window["flagged"] & (window["date"] < event_date)]
    if not flagged_rows.empty:
        first_flag_date = pd.to_datetime(flagged_rows["date"].iloc[0])
        lead_days = (event_date - first_flag_date).days
        print(f"\nRESULT: model would have flagged segment {seg_id} on {first_flag_date.date()}, "
              f"{lead_days} day(s) before the closure was recorded on {event_date.date()}.")
        print(f'Pitch line: "On {first_flag_date.date()}, Nirantar\'s model would have flagged {seg_id}. '
              f'The closure was recorded on {event_date.date()} — {lead_days} day(s) of warning."')
    else:
        print(f"\nRESULT: model did NOT cross the decision threshold before the event date "
              f"({event_date.date()}) for this particular closure. Reported honestly — "
              f"this is a real model weakness to disclose in Q&A, not to hide.")

    window.to_csv("outputs/backtest_result.csv", index=False)
    return window


if __name__ == "__main__":
    run_backtest()
