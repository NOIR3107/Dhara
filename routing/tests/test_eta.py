"""
tests/test_eta.py — Module 4: ETA calculation and delay factors
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import eta
from eta import ETAConditions, ETAResult
import config


# ---------------------------------------------------------------------------
# Minimal synthetic route for deterministic testing
# ---------------------------------------------------------------------------

def make_route(edges):
    """Build a minimal RouteResult from a list of edge dicts."""
    total_time = sum(e["travel_time_min"] for e in edges)
    total_dist = sum(e["length_km"] for e in edges)
    path = ["node_start"] + [f"node_{i}" for i in range(len(edges))]
    return {
        "origin":             "node_start",
        "destination":        path[-1],
        "path":               path,
        "total_time_minutes": total_time,
        "total_distance_km":  total_dist,
        "edges":              edges,
    }


PAVED_EDGE = {
    "osmid": "e_paved", "name": "Test Road", "highway": "primary",
    "surface": "paved", "length_km": 10.0, "travel_time_min": 12.0,
    "district": "test", "is_night_restricted": False,
    "is_single_lane_bridge": False, "is_chokepoint": False,
}

UNPAVED_EDGE = {
    "osmid": "e_unpaved", "name": "Dirt Road", "highway": "track",
    "surface": "gravel", "length_km": 5.0, "travel_time_min": 20.0,
    "district": "test", "is_night_restricted": True,
    "is_single_lane_bridge": False, "is_chokepoint": False,
}


class TestComputeETA:
    def test_baseline_no_factors(self):
        route = make_route([PAVED_EDGE])
        conditions = ETAConditions(rainfall_level=0, is_night=False)
        result = eta.compute_eta(route, conditions)
        assert result["route_type"] == "normal"
        assert result["baseline_minutes"] == pytest.approx(12.0)
        assert result["adjusted_minutes"] == pytest.approx(12.0)
        assert result["delay_factors_applied"] == []

    def test_rain_multiplier_applied(self):
        route = make_route([PAVED_EDGE])
        conditions = ETAConditions(rainfall_level=2, is_night=False)
        result = eta.compute_eta(route, conditions)
        expected = 12.0 * config.ETA_RAIN_MULTIPLIER[2]
        assert result["adjusted_minutes"] == pytest.approx(expected)
        assert "rain" in result["delay_factors_applied"]

    def test_no_rain_no_rain_factor(self):
        route = make_route([PAVED_EDGE])
        conditions = ETAConditions(rainfall_level=0)
        result = eta.compute_eta(route, conditions)
        assert "rain" not in result["delay_factors_applied"]

    def test_poor_surface_multiplier(self):
        route = make_route([UNPAVED_EDGE])
        conditions = ETAConditions(rainfall_level=0, is_night=False)
        result = eta.compute_eta(route, conditions)
        expected = 20.0 * config.ETA_POOR_SURFACE_MULTIPLIER
        assert result["adjusted_minutes"] == pytest.approx(expected)
        assert "poor_surface" in result["delay_factors_applied"]

    def test_paved_surface_no_poor_surface_factor(self):
        route = make_route([PAVED_EDGE])
        conditions = ETAConditions()
        result = eta.compute_eta(route, conditions)
        assert "poor_surface" not in result["delay_factors_applied"]

    def test_night_restriction_flagged_only(self):
        """Night multiplier applies only to edges with is_night_restricted=True
        when NIGHT_RESTRICTION_SCOPE='flagged_only'."""
        route = make_route([UNPAVED_EDGE])  # UNPAVED_EDGE has is_night_restricted=True
        conditions = ETAConditions(is_night=True)
        original_scope = config.NIGHT_RESTRICTION_SCOPE
        config.NIGHT_RESTRICTION_SCOPE = "flagged_only"
        result = eta.compute_eta(route, conditions)
        config.NIGHT_RESTRICTION_SCOPE = original_scope
        assert "night_restriction" in result["delay_factors_applied"]

    def test_night_restriction_not_applied_to_unrestricted_edge(self):
        """Paved edge (is_night_restricted=False) should not get night multiplier."""
        route = make_route([PAVED_EDGE])  # PAVED_EDGE has is_night_restricted=False
        conditions = ETAConditions(is_night=True)
        original_scope = config.NIGHT_RESTRICTION_SCOPE
        config.NIGHT_RESTRICTION_SCOPE = "flagged_only"
        result = eta.compute_eta(route, conditions)
        config.NIGHT_RESTRICTION_SCOPE = original_scope
        assert "night_restriction" not in result["delay_factors_applied"]

    def test_congestion_multiplier_applied(self):
        route = make_route([PAVED_EDGE])
        congestion_scores = {"e_paved": 0.3}
        conditions = ETAConditions(congestion_scores=congestion_scores)
        result = eta.compute_eta(route, conditions)
        expected = 12.0 * 1.3
        assert result["adjusted_minutes"] == pytest.approx(expected)
        assert "congestion" in result["delay_factors_applied"]

    def test_multiple_factors_combined(self):
        route = make_route([UNPAVED_EDGE])  # gravel, night restricted
        conditions = ETAConditions(
            rainfall_level=1,
            is_night=True,
            congestion_scores={"e_unpaved": 0.2},
        )
        original_scope = config.NIGHT_RESTRICTION_SCOPE
        config.NIGHT_RESTRICTION_SCOPE = "flagged_only"
        result = eta.compute_eta(route, conditions)
        config.NIGHT_RESTRICTION_SCOPE = original_scope

        # Expected: 20 * rain * surface * night * (1 + congestion)
        expected = (20.0
                    * config.ETA_RAIN_MULTIPLIER[1]
                    * config.ETA_POOR_SURFACE_MULTIPLIER
                    * config.ETA_NIGHT_MULTIPLIER
                    * 1.2)
        assert result["adjusted_minutes"] == pytest.approx(expected, rel=1e-3)
        factors = set(result["delay_factors_applied"])
        assert "rain"             in factors
        assert "poor_surface"     in factors
        assert "night_restriction" in factors
        assert "congestion"       in factors

    def test_adjusted_always_gte_baseline(self):
        """Delay factors should never reduce travel time below baseline."""
        route = make_route([PAVED_EDGE])
        conditions = ETAConditions(rainfall_level=3, is_night=True)
        result = eta.compute_eta(route, conditions)
        assert result["adjusted_minutes"] >= result["baseline_minutes"]

    def test_empty_route(self):
        route = make_route([])
        conditions = ETAConditions()
        result = eta.compute_eta(route, conditions)
        assert result["baseline_minutes"] == 0.0
        assert result["adjusted_minutes"] == 0.0


class TestComputeBothETAs:
    def test_both_etas_structure(self):
        normal  = make_route([PAVED_EDGE])
        alt     = make_route([UNPAVED_EDGE])
        conditions = ETAConditions()
        result = eta.compute_both_etas(normal, alt, conditions)
        assert "normal"    in result
        assert "alternate" in result
        assert "delay_delta_minutes" in result

    def test_delta_is_alternate_minus_normal(self):
        normal     = make_route([PAVED_EDGE])
        alternate  = make_route([UNPAVED_EDGE])
        conditions = ETAConditions()
        result = eta.compute_both_etas(normal, alternate, conditions)
        expected_delta = result["alternate"]["adjusted_minutes"] - result["normal"]["adjusted_minutes"]
        assert result["delay_delta_minutes"] == pytest.approx(expected_delta)

    def test_none_alternate_produces_none_eta(self):
        normal = make_route([PAVED_EDGE])
        conditions = ETAConditions()
        result = eta.compute_both_etas(normal, None, conditions)
        assert result["alternate"] is None
        assert result["delay_delta_minutes"] is None


class TestNightTravelHelper:
    def test_night_hours_return_true(self):
        for h in [20, 21, 22, 23, 0, 1, 2, 3, 4, 5]:
            assert eta.is_night_travel(h), f"Hour {h} should be night"

    def test_day_hours_return_false(self):
        for h in [6, 7, 8, 12, 14, 18, 19]:
            assert not eta.is_night_travel(h), f"Hour {h} should be day"
