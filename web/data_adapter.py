"""
web/data_adapter.py
--------------------
Isolated data adapter that extracts and formats live pipeline outputs
from model/, outputs/, and data/ for the DHARA Command Center web client.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "model"))
sys.path.insert(0, str(ROOT_DIR / "routing"))

from vri import compute_vri
from countdown import compute_countdown
from egress import compute_egress
from confidence import compute_district_confidence
from closure_prediction import predict_closure_probability
from vri import build_future_feature_rows
import config as routing_config

# Coordinated NER geographic positions for demo habitations (West Hills / Kameng-Tawang corridor)
VILLAGE_COORDS = {
    "VIL_00": {"lat": 27.124, "lon": 93.892, "name": "Lumla Ridge"},
    "VIL_01": {"lat": 27.185, "lon": 94.015, "name": "Mago Valley"},
    "VIL_02": {"lat": 27.052, "lon": 94.110, "name": "Thingbu Camp"},
    "VIL_03": {"lat": 27.291, "lon": 94.180, "name": "Mukto Basti"},
    "VIL_04": {"lat": 27.240, "lon": 93.940, "name": "Zemithang Post"},
    "VIL_05": {"lat": 27.310, "lon": 94.050, "name": "Bongleng Hamlet"},
    "VIL_06": {"lat": 27.085, "lon": 94.245, "name": "Lhou Settlement"},
    "VIL_07": {"lat": 27.160, "lon": 94.310, "name": "Kitpi Village"},
    "VIL_08": {"lat": 27.345, "lon": 94.120, "name": "Seru Valley"},
    "VIL_09": {"lat": 27.020, "lon": 93.980, "name": "Khyam Upper"},
    "VIL_10": {"lat": 27.210, "lon": 94.260, "name": "Dungkhar Basti"},
    "VIL_11": {"lat": 27.275, "lon": 94.340, "name": "Gomkellang Reach"},
}

DEPOT_COORDS = {
    "DEPOT_A": {"lat": 27.150, "lon": 94.150, "name": "District Central Depot (West Hills)"},
    "DEPOT_B": {"lat": 27.080, "lon": 93.920, "name": "Western Forward Depot"},
}


def get_command_center_data() -> Dict[str, Any]:
    """Extracts, calculates, and returns complete structured data for the frontend."""
    data_dir = ROOT_DIR / "data"
    outputs_dir = ROOT_DIR / "outputs"

    segments_df = pd.read_csv(data_dir / "road_segments.csv")
    weather_closures_df = pd.read_csv(data_dir / "weather_closures.csv")
    villages_df = pd.read_pickle(data_dir / "villages.pkl")
    depots_df = pd.read_csv(data_dir / "depots.csv")

    # Load dispatch decisions and reasoning from backend
    dispatch_df = pd.read_csv(outputs_dir / "dispatch_decisions.csv")
    dispatch_lookup = dispatch_df.set_index("village_id").to_dict("index")

    # Compute baseline metrics across 7 forecast days
    as_of_dt = pd.to_datetime(weather_closures_df["date"]).max()
    vri_df = compute_vri(segments_df, weather_closures_df, villages_df, forecast_days=7, as_of_date=as_of_dt)
    countdown_df = compute_countdown(vri_df, as_of_datetime=as_of_dt)
    egress_df = compute_egress(segments_df, weather_closures_df, villages_df, countdown_df, as_of_date=as_of_dt)
    conf_df = compute_district_confidence(weather_closures_df, segments_df, as_of_date=as_of_dt)

    district_conf = conf_df.iloc[0].to_dict() if len(conf_df) else {}

    # Forecast dates mapping (Day 0 to Day 7)
    dates = sorted(vri_df["date"].unique())
    day_labels = [f"Day {i+1} ({pd.to_datetime(d).strftime('%d %b')})" for i, d in enumerate(dates)]
    
    # Habitations array
    countdown_lookup = countdown_df.set_index("village_id").to_dict("index")
    egress_lookup = egress_df.set_index("village_id").to_dict("index")

    habitations = []
    for v in villages_df.itertuples():
        vid = v.village_id
        coords = VILLAGE_COORDS.get(vid, {"lat": 27.15, "lon": 94.10, "name": f"Village {vid}"})
        cd = countdown_lookup.get(vid, {})
        eg = egress_lookup.get(vid, {})
        disp = dispatch_lookup.get(vid, None)

        # 7-day trajectory of VRI
        v_vri = vri_df[vri_df["village_id"] == vid].sort_values("date")
        trajectory = []
        for _, row in v_vri.iterrows():
            trajectory.append({
                "date": str(row["date"]),
                "vri": float(row["vri"]),
                "reachability_prob": float(row["reachability_prob"]),
                "confidence": float(row["confidence"]),
            })

        habitations.append({
            "village_id": vid,
            "name": coords["name"],
            "lat": coords["lat"],
            "lon": coords["lon"],
            "district": v.district,
            "population": int(v.population),
            "route_1": v.route_1,
            "route_2": v.route_2,
            "dist_to_health_facility_km": float(v.dist_to_health_facility_km),
            "dist_to_depot_km": float(v.dist_to_depot_km),
            "current_vri": float(cd.get("current_vri", 100.0)),
            "hours_until_cutoff": cd.get("hours_until_cutoff", None) if pd.notna(cd.get("hours_until_cutoff")) else None,
            "status": cd.get("status", "no_cutoff_in_window"),
            "predicted_cutoff_date": str(cd.get("predicted_cutoff_date", "")) if pd.notna(cd.get("predicted_cutoff_date")) else None,
            "travel_time_now_min": float(eg.get("travel_time_now_min", 0.0)),
            "travel_time_after_closure_min": float(eg.get("travel_time_after_closure_min", 0.0)),
            "egress_delta_min": float(eg.get("egress_delta_min", 0.0)),
            "egress_mode_after_closure": str(eg.get("egress_mode_after_closure", "road_unaffected")),
            "trajectory": trajectory,
            "dispatch": {
                "has_dispatch": disp is not None,
                "depot": disp.get("depot") if disp else None,
                "commodity": disp.get("commodity") if disp else None,
                "required_units": int(disp.get("required_units")) if disp else 0,
                "shipped_units": int(disp.get("shipped_units")) if disp else 0,
                "shortfall_units": int(disp.get("shortfall_units")) if disp else 0,
                "latest_departure_time": str(disp.get("latest_departure_time")) if disp else None,
                "departure_status": str(disp.get("departure_status")) if disp else None,
                "action": str(disp.get("action")) if disp else None,
                "governance_confidence": float(disp.get("governance_confidence")) if disp else None,
                "override_window_expires_at": str(disp.get("override_window_expires_at")) if disp else None,
                "reasoning": str(disp.get("reasoning")) if disp else None,
            } if disp else None,
        })

    # Depots list
    depots = []
    for d in depots_df.itertuples():
        coords = DEPOT_COORDS.get(d.depot_id, {"lat": 27.15, "lon": 94.15, "name": d.depot_id})
        depots.append({
            "depot_id": d.depot_id,
            "name": coords["name"],
            "lat": coords["lat"],
            "lon": coords["lon"],
            "district": d.district,
            "stock_units": int(d.stock_units),
            "commodity": d.commodity,
        })

    # High-level KPIs
    cutoff_count = sum(1 for h in habitations if h["status"] in ["cut_off_now", "cutoff_predicted"])
    avg_vri = round(sum(h["current_vri"] for h in habitations) / max(len(habitations), 1), 1)
    total_required = sum(h["dispatch"]["required_units"] for h in habitations if h["dispatch"])
    total_shipped = sum(h["dispatch"]["shipped_units"] for h in habitations if h["dispatch"])

    return {
        "metadata": {
            "title": "DHARA — Disaster Hazard Adaptation & Relief Automation",
            "region": "North-East India (West Hills District)",
            "as_of_date": str(as_of_dt.date()),
            "forecast_days": len(dates),
            "forecast_dates": [str(d) for d in dates],
            "day_labels": day_labels,
            "simulation_mode": True,
            "simulation_notice": "SIMULATED NER TERRAIN & WEATHER DATA",
        },
        "district_confidence": district_conf,
        "kpis": {
            "total_habitations": len(habitations),
            "cutoff_predicted_count": cutoff_count,
            "average_vri": avg_vri,
            "active_dispatches": len(dispatch_df),
            "supplies_shipped": total_shipped,
            "supplies_required": total_required,
            "governance_status": "5 Act-With-Override (2h Window)",
        },
        "habitations": habitations,
        "depots": depots,
    }


if __name__ == "__main__":
    data = get_command_center_data()
    print(f"Loaded {len(data['habitations'])} habitations, {len(data['depots'])} depots.")
    print("KPIs:", data["kpis"])
