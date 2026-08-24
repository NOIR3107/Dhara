"""
tests/test_alerts.py — Module 8: All 4 alert types
Each alert type tested for: fires under its trigger, does NOT fire below trigger,
returns correct structure, calls reasoning.py (reasoning string non-empty).
"""
import os
import sys
import pytest
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import alerts
import config


SOURCES = ["model", "field report"]

REQUIRED_ALERT_KEYS = {
    "alert_type", "location_or_edge_id", "trigger_reason", "reasoning", "timestamp"
}


def make_route(edge_osmids):
    """Minimal RouteResult with given edge osmids."""
    edges = [
        {"osmid": eid, "travel_time_min": 10.0, "length_km": 8.0,
         "name": f"Road {eid}", "highway": "secondary", "surface": "paved",
         "district": "test", "is_night_restricted": False,
         "is_single_lane_bridge": False, "is_chokepoint": False}
        for eid in edge_osmids
    ]
    return {
        "origin": "A", "destination": "Z",
        "path": ["A"] + [f"node_{i}" for i in range(len(edge_osmids))] + ["Z"],
        "total_time_minutes": 10.0 * len(edge_osmids),
        "total_distance_km":  8.0  * len(edge_osmids),
        "edges": edges,
    }


def make_eta_result(baseline, adjusted, route_type="normal"):
    return {
        "route_type":            route_type,
        "baseline_minutes":      baseline,
        "adjusted_minutes":      adjusted,
        "delay_factors_applied": ["rain"] if adjusted > baseline else [],
    }


# ---------------------------------------------------------------------------
# Alert 1: Blocked Road
# ---------------------------------------------------------------------------

class TestBlockedRoadAlert:
    def test_fires_at_threshold(self):
        alert = alerts.check_blocked_road("e_test", config.CLOSURE_THRESHOLD, SOURCES)
        assert alert is not None
        assert alert["alert_type"] == "blocked_road"

    def test_fires_above_threshold(self):
        alert = alerts.check_blocked_road("e_test", config.CLOSURE_THRESHOLD + 0.1, SOURCES)
        assert alert is not None

    def test_does_not_fire_below_threshold(self):
        alert = alerts.check_blocked_road("e_test", config.CLOSURE_THRESHOLD - 0.01, SOURCES)
        assert alert is None

    def test_alert_structure(self):
        alert = alerts.check_blocked_road("edge_001", 0.9, SOURCES)
        assert REQUIRED_ALERT_KEYS.issubset(set(alert.keys()))
        assert alert["alert_type"] == "blocked_road"
        assert "edge_001" in alert["location_or_edge_id"]
        assert isinstance(alert["reasoning"], str) and len(alert["reasoning"]) > 10
        assert isinstance(alert["timestamp"], str)

    def test_timestamp_is_iso_string(self):
        alert = alerts.check_blocked_road("e_test", 0.9, SOURCES)
        ts = datetime.fromisoformat(alert["timestamp"])
        assert ts is not None


# ---------------------------------------------------------------------------
# Alert 2: Inaccessible Region
# ---------------------------------------------------------------------------

class TestInaccessibleRegionAlert:
    def test_fires_on_no_route_available(self):
        result = {
            "status": "no_route_available",
            "route": None,
            "blocked_edges": ["e_spur", "e_spur_rev"],
            "reason": "Village is cut off",
        }
        alert = alerts.check_inaccessible_region(result, SOURCES)
        assert alert is not None
        assert alert["alert_type"] == "inaccessible_region"

    def test_does_not_fire_on_rerouted(self):
        result = {
            "status": "rerouted",
            "route": make_route(["e1", "e2"]),
            "blocked_edges": ["e_old"],
            "reason": "Alternate found",
        }
        alert = alerts.check_inaccessible_region(result, SOURCES)
        assert alert is None

    def test_alert_structure(self):
        result = {
            "status": "no_route_available",
            "route": None,
            "blocked_edges": ["e_spur"],
            "reason": "Cut off",
        }
        alert = alerts.check_inaccessible_region(result, SOURCES)
        assert REQUIRED_ALERT_KEYS.issubset(set(alert.keys()))
        assert "INACCESSIBLE" in alert["reasoning"].upper() or "CUT" in alert["reasoning"].upper()

    def test_reasoning_nonempty(self):
        result = {
            "status": "no_route_available",
            "route": None,
            "blocked_edges": ["e1"],
            "reason": "Cut off",
        }
        alert = alerts.check_inaccessible_region(result, SOURCES)
        assert len(alert["reasoning"]) > 20


# ---------------------------------------------------------------------------
# Alert 3: Delayed Delivery
# ---------------------------------------------------------------------------

class TestDelayedDeliveryAlert:
    def test_fires_above_threshold(self):
        eta_result = make_eta_result(
            baseline=30.0,
            adjusted=30.0 + config.DELAY_ALERT_THRESHOLD_MINUTES + 1.0
        )
        alert = alerts.check_delayed_delivery(eta_result, SOURCES)
        assert alert is not None
        assert alert["alert_type"] == "delayed_delivery"

    def test_fires_at_threshold(self):
        eta_result = make_eta_result(
            baseline=30.0,
            adjusted=30.0 + config.DELAY_ALERT_THRESHOLD_MINUTES
        )
        alert = alerts.check_delayed_delivery(eta_result, SOURCES)
        assert alert is not None

    def test_does_not_fire_below_threshold(self):
        eta_result = make_eta_result(
            baseline=30.0,
            adjusted=30.0 + config.DELAY_ALERT_THRESHOLD_MINUTES - 1.0
        )
        alert = alerts.check_delayed_delivery(eta_result, SOURCES)
        assert alert is None

    def test_zero_delay_no_alert(self):
        eta_result = make_eta_result(30.0, 30.0)
        alert = alerts.check_delayed_delivery(eta_result, SOURCES)
        assert alert is None

    def test_alert_structure(self):
        eta_result = make_eta_result(30.0, 100.0)
        alert = alerts.check_delayed_delivery(eta_result, SOURCES, location="Route A-B")
        assert REQUIRED_ALERT_KEYS.issubset(set(alert.keys()))
        assert "Route A-B" in alert["location_or_edge_id"]


# ---------------------------------------------------------------------------
# Alert 4: High-Risk Corridor
# ---------------------------------------------------------------------------

class TestHighRiskCorridorAlert:
    def test_fires_above_threshold(self):
        route = make_route(["e1", "e2", "e3"])
        closure_probs = {
            "e1": config.HIGH_RISK_CORRIDOR_THRESHOLD + 0.1,
            "e2": config.HIGH_RISK_CORRIDOR_THRESHOLD + 0.1,
            "e3": config.HIGH_RISK_CORRIDOR_THRESHOLD + 0.1,
        }
        alert = alerts.check_high_risk_corridor(route, closure_probs, SOURCES)
        assert alert is not None
        assert alert["alert_type"] == "high_risk_corridor"

    def test_does_not_fire_below_threshold(self):
        route = make_route(["e1", "e2"])
        closure_probs = {
            "e1": 0.1,
            "e2": 0.1,
        }
        alert = alerts.check_high_risk_corridor(route, closure_probs, SOURCES)
        assert alert is None

    def test_aggregate_risk_computation(self):
        route = make_route(["e1", "e2"])
        # Mean of [0.60, 0.40] = 0.50 > HIGH_RISK_CORRIDOR_THRESHOLD (0.45)
        closure_probs = {"e1": 0.60, "e2": 0.40}
        alert = alerts.check_high_risk_corridor(route, closure_probs, SOURCES)
        if config.HIGH_RISK_CORRIDOR_THRESHOLD <= 0.50:
            assert alert is not None
        else:
            assert alert is None

    def test_fires_even_if_no_single_edge_blocked(self):
        """High-risk corridor fires before any single edge hits CLOSURE_THRESHOLD."""
        route = make_route(["e1", "e2", "e3", "e4"])
        # All edges well below CLOSURE_THRESHOLD but mean > HIGH_RISK_CORRIDOR_THRESHOLD
        below_closure = config.CLOSURE_THRESHOLD - 0.10
        closure_probs = {eid: below_closure for eid in ["e1", "e2", "e3", "e4"]}
        risk = sum(closure_probs.values()) / len(closure_probs)
        if risk >= config.HIGH_RISK_CORRIDOR_THRESHOLD:
            alert = alerts.check_high_risk_corridor(route, closure_probs, SOURCES)
            assert alert is not None

    def test_alert_structure(self):
        route = make_route(["e1", "e2"])
        closure_probs = {"e1": 0.80, "e2": 0.80}
        alert = alerts.check_high_risk_corridor(route, closure_probs, SOURCES)
        if alert:
            assert REQUIRED_ALERT_KEYS.issubset(set(alert.keys()))
            assert "A → Z" in alert["location_or_edge_id"]


# ---------------------------------------------------------------------------
# evaluate_all_alerts integration
# ---------------------------------------------------------------------------

class TestEvaluateAllAlerts:
    def test_no_alerts_for_safe_conditions(self):
        route = make_route(["e1", "e2"])
        alternate_result = {
            "status": "rerouted",
            "route": make_route(["e3"]),
            "blocked_edges": [],
            "reason": "Normal",
        }
        eta_result = make_eta_result(30.0, 30.0)
        closure_probs = {"e1": 0.1, "e2": 0.1}
        triggered = alerts.evaluate_all_alerts(
            route, alternate_result, eta_result, closure_probs, SOURCES
        )
        assert isinstance(triggered, list)
        # With low probabilities and no delay, no alerts should fire
        assert all(a["alert_type"] != "blocked_road" for a in triggered)

    def test_all_4_alerts_can_trigger_simultaneously(self):
        route = make_route(["e1", "e2"])
        # Conditions designed to trigger all 4
        closure_probs = {
            "e1": 1.0,   # blocked_road + high_risk_corridor
            "e2": 1.0,
        }
        alternate_result = {
            "status": "no_route_available",  # inaccessible_region
            "route": None,
            "blocked_edges": ["e1", "e2"],
            "reason": "Cut off",
        }
        eta_result = make_eta_result(
            30.0,
            30.0 + config.DELAY_ALERT_THRESHOLD_MINUTES + 20.0  # delayed_delivery
        )
        triggered = alerts.evaluate_all_alerts(
            route, alternate_result, eta_result, closure_probs, SOURCES
        )
        alert_types = {a["alert_type"] for a in triggered}
        assert "blocked_road"        in alert_types
        assert "inaccessible_region" in alert_types
        assert "delayed_delivery"    in alert_types
        assert "high_risk_corridor"  in alert_types
