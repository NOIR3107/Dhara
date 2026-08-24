"""
decision_pipeline.py
---------------------
Thin adapter bridging:
  model/closure_prediction.py -> VRI / countdown / egress / prepositioning -> routing/automation.py

Pipeline flow:
  1. Consumes the prediction DataFrame / trained closure model (predict_closure_probability).
  2. Computes district confidence, VRI reachability, cutoff countdowns, emergency egress,
     and pre-positioning dispatch plans.
  3. Adapts segment-level probabilities and village risk into route-level context
     (scalar confidence, data sources, route_info, and extras like blocked segments and delays).
  4. Feeds the context directly into routing/automation.py:decide_action().
  5. Outputs the final dispatch decision, governance tier, and reasoning.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd

# Fix Windows console UTF-8 encoding if available
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure model and routing packages are accessible in path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "model"))
sys.path.insert(0, str(ROOT_DIR / "routing"))

# Model imports
import config as routing_config
from closure_prediction import predict_closure_probability, train_and_evaluate
from confidence import compute_district_confidence
from vri import compute_vri, build_future_feature_rows
from countdown import compute_countdown
from egress import compute_egress
from prepositioning import generate_dispatch_plan
from synthetic_data import build_all

# Routing & Governance imports
import automation
import reasoning


def run_decision_pipeline(
    segments_df: pd.DataFrame,
    weather_closures_df: pd.DataFrame,
    villages_df: pd.DataFrame,
    depots_df: pd.DataFrame,
    forecast_days: int = 7,
    as_of_datetime: Optional[Any] = None,
    commodity: str = "rations",
) -> pd.DataFrame:
    """
    Executes the end-to-end prediction-to-decision adapter pipeline.

    Args:
        segments_df         : Road segments static attributes.
        weather_closures_df : Weather and closure history.
        villages_df         : Village network and population data.
        depots_df           : Depot inventory data.
        forecast_days       : Number of forecast days for VRI calculation.
        as_of_datetime      : Timestamp baseline for evaluation.
        commodity           : Pre-positioned commodity name.

    Returns:
        DataFrame containing dispatch orders augmented with governance tiers,
        confidence scores, override window expiry, and explanation reasoning.
    """
    as_of_dt = pd.to_datetime(as_of_datetime) if as_of_datetime else pd.to_datetime(weather_closures_df["date"]).max()

    # Ensure model artifact exists before prediction
    model_file = Path("models/closure_model.pkl")
    if not model_file.exists():
        Path("models").mkdir(parents=True, exist_ok=True)
        print("[decision_pipeline] Model weights not found. Training closure model...")
        train_and_evaluate()

    # -------------------------------------------------------------------------
    # Step 1: Segment-level closure prediction & confidence computation
    # -------------------------------------------------------------------------
    conf_df = compute_district_confidence(weather_closures_df, segments_df, as_of_date=as_of_dt)
    district_conf_lookup = dict(zip(conf_df["district"], conf_df["confidence"]))

    # -------------------------------------------------------------------------
    # Step 2: Habitation risk assessment (VRI, Countdown, Egress)
    # -------------------------------------------------------------------------
    vri_df = compute_vri(
        segments_df=segments_df,
        weather_closures_df=weather_closures_df,
        villages_df=villages_df,
        forecast_days=forecast_days,
        as_of_date=as_of_dt,
    )

    countdown_df = compute_countdown(vri_df, as_of_datetime=as_of_dt)
    egress_df = compute_egress(
        segments_df=segments_df,
        weather_closures_df=weather_closures_df,
        villages_df=villages_df,
        countdown_df=countdown_df,
        as_of_date=as_of_dt,
    )

    # -------------------------------------------------------------------------
    # Step 3: Pre-positioning dispatch planning
    # -------------------------------------------------------------------------
    dispatch_plan_df = generate_dispatch_plan(
        countdown_df=countdown_df,
        villages_df=villages_df,
        segments_df=segments_df,
        weather_closures_df=weather_closures_df,
        depots_df=depots_df,
        commodity=commodity,
        as_of_datetime=as_of_dt,
    )

    if dispatch_plan_df.empty:
        return pd.DataFrame()

    # -------------------------------------------------------------------------
    # Step 4: Identify blocked segments across the forecast horizon
    # -------------------------------------------------------------------------
    forecast_dates = [as_of_dt + pd.Timedelta(days=i) for i in range(1, forecast_days + 1)]
    future_rows = build_future_feature_rows(segments_df, weather_closures_df, forecast_dates)
    proba_df = predict_closure_probability(future_rows)

    blocked_segments = sorted(
        proba_df[proba_df["closure_probability"] >= routing_config.CLOSURE_THRESHOLD]["segment_id"]
        .unique()
        .tolist()
    )

    # Index lookups for context packaging
    egress_lookup = egress_df.set_index("village_id").to_dict("index")
    villages_lookup = villages_df.set_index("village_id").to_dict("index")

    # -------------------------------------------------------------------------
    # Step 5: Adapt segment/habitation context into decide_action() inputs
    # -------------------------------------------------------------------------
    decision_records = []

    for r in dispatch_plan_df.itertuples():
        v_info = villages_lookup.get(r.village_id, {})
        e_info = egress_lookup.get(r.village_id, {})

        # Scalar confidence from the district data volume/recency/coverage model
        confidence = float(district_conf_lookup.get(r.district, 0.50))

        # Provenance source labels for audit & reasoning chain
        data_sources = [
            "ML road closure model (XGBoost/LR)",
            f"District historical data confidence ({confidence:.2f})",
            "VRI village reachability index",
            "Emergency egress analysis",
        ]

        # Route info context for reasoning engine
        route_info = {
            "origin": r.depot,
            "destination": r.village_id,
            "total_time_minutes": round(r.travel_time_hours * 60.0, 1),
            "total_distance_km": float(v_info.get("dist_to_depot_km", 0.0)),
        }

        # Extra operational signals
        village_segments = set((v_info.get("route_1") or []) + (v_info.get("route_2") or []))
        route_blocked_edges = [s for s in blocked_segments if s in village_segments]

        extras = {
            "blocked_edges": route_blocked_edges or blocked_segments,
            "delay_delta_minutes": float(e_info.get("egress_delta_min", 0.0)),
            "village_id": r.village_id,
            "hours_until_cutoff": r.hours_until_cutoff if hasattr(r, "hours_until_cutoff") else None,
            "departure_status": r.departure_status,
            "required_units": r.required_units,
        }

        # Evaluate through 3-tier governance logic (auto_dispatch / act_with_override / escalate)
        action_decision = automation.decide_action(
            confidence=confidence,
            data_sources=data_sources,
            route_info=route_info,
            extras=extras,
        )

        record = {
            "village_id": r.village_id,
            "district": r.district,
            "depot": r.depot,
            "commodity": r.commodity,
            "required_units": r.required_units,
            "shipped_units": r.shipped_units,
            "shortfall_units": r.shortfall_units,
            "latest_departure_time": r.latest_departure_time,
            "departure_status": r.departure_status,
            "action": action_decision["action"],
            "governance_confidence": action_decision["confidence"],
            "override_window_expires_at": action_decision["override_window_expires_at"],
            "reasoning": action_decision["reasoning"],
        }
        decision_records.append(record)

    return pd.DataFrame(decision_records)


def main():
    """Runs the adapter pipeline on available or generated dataset."""
    data_dir = ROOT_DIR / "data"
    segments_path = data_dir / "road_segments.csv"
    closures_path = data_dir / "weather_closures.csv"
    villages_path = data_dir / "villages.pkl"
    depots_path = data_dir / "depots.csv"

    if not (segments_path.exists() and closures_path.exists() and villages_path.exists() and depots_path.exists()):
        print("[decision_pipeline] Data files not found. Generating synthetic dataset...")
        segments_df, weather_closures_df, villages_df, depots_df = build_all(out_dir=str(data_dir))
    else:
        segments_df = pd.read_csv(segments_path)
        weather_closures_df = pd.read_csv(closures_path)
        villages_df = pd.read_pickle(villages_path)
        depots_df = pd.read_csv(depots_path)

    print("\nExecuting decision pipeline adapter...")
    decisions_df = run_decision_pipeline(segments_df, weather_closures_df, villages_df, depots_df)

    print(f"\nGenerated {len(decisions_df)} dispatch decisions with governance tiers:\n")
    for _, row in decisions_df.iterrows():
        print(f"[{row['action'].upper()}] Village: {row['village_id']} | Depot: {row['depot']} | "
              f"Units: {row['shipped_units']}/{row['required_units']} | Conf: {row['governance_confidence']}")
        print(f"  Reasoning: {row['reasoning']}")
        if row['override_window_expires_at']:
            print(f"  Override Window Closes: {row['override_window_expires_at']}")
        print("-" * 80)

    # Save outputs
    out_dir = ROOT_DIR / "outputs"
    out_dir.mkdir(exist_ok=True)
    decisions_df.to_csv(out_dir / "dispatch_decisions.csv", index=False)
    print(f"\nSaved dispatch decisions to {out_dir / 'dispatch_decisions.csv'}")


if __name__ == "__main__":
    main()
