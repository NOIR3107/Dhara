"""
tests/test_congestion.py — Module 5: Structural congestion proxy
"""
import os
import sys
import pytest
from datetime import datetime, date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import congestion
import config


@pytest.fixture
def calendar():
    path = os.path.join(os.path.dirname(__file__), "..", config.CONGESTION_CALENDAR_PATH)
    return congestion.CongestionCalendar(path)


@pytest.fixture
def single_lane_bridge_edge():
    return {
        "osmid": "test_bridge",
        "highway": "secondary",
        "surface": "paved",
        "is_single_lane_bridge": True,
        "is_chokepoint": False,
        "district": "hill_tbd",
    }


@pytest.fixture
def normal_edge():
    return {
        "osmid": "test_normal",
        "highway": "primary",
        "surface": "paved",
        "is_single_lane_bridge": False,
        "is_chokepoint": False,
        "district": "hill_tbd",
    }


@pytest.fixture
def chokepoint_edge():
    return {
        "osmid": "test_chokepoint",
        "highway": "tertiary",
        "surface": "paved",
        "is_single_lane_bridge": False,
        "is_chokepoint": True,
        "district": "valley_tbd",
    }


class TestCongestionCalendar:
    def test_calendar_loads(self, calendar):
        assert calendar is not None
        assert calendar._data != {}

    def test_market_day_weekly(self, calendar):
        # Wednesday = 2 is a market day for hill_tbd
        # Find a Wednesday in a test period
        test_date = date(2026, 8, 26)  # This is a Wednesday
        assert calendar.is_market_day("hill_tbd", test_date)

    def test_non_market_day(self, calendar):
        # Thursday = 3 is NOT a market day for hill_tbd
        test_date = date(2026, 8, 27)  # Thursday
        assert not calendar.is_market_day("hill_tbd", test_date)

    def test_specific_market_date(self, calendar):
        specific = date(2026, 8, 26)
        assert calendar.is_market_day("hill_tbd", specific)

    def test_global_festival_day(self, calendar):
        # Independence Day is a global festival (2026-08-15)
        test_date = date(2026, 8, 15)
        assert calendar.is_festival_day("hill_tbd", test_date)
        assert calendar.is_festival_day("valley_tbd", test_date)

    def test_unknown_district_no_crash(self, calendar):
        # Unknown district should return False, not raise
        assert not calendar.is_market_day("UNKNOWN_DIST", date(2026, 8, 1))
        assert not calendar.is_festival_day("UNKNOWN_DIST", date(2026, 8, 1))

    def test_missing_calendar_file_no_crash(self):
        # Missing calendar should warn but not raise
        cal = congestion.CongestionCalendar("nonexistent_calendar.yaml")
        assert not cal.is_market_day("hill_tbd", date(2026, 8, 1))


class TestScoreEdge:
    def test_single_lane_bridge_score(self, single_lane_bridge_edge, calendar):
        ts = datetime(2026, 8, 27, 10, 0)  # Thursday (not market day)
        score = congestion.score_edge(single_lane_bridge_edge, ts, calendar=calendar)
        assert score >= config.CONGESTION_SINGLE_LANE_BRIDGE

    def test_normal_edge_no_factors_zero_score(self, normal_edge, calendar):
        # Use a date that is NOT a market day or festival for hill_tbd
        # Monday = 0 is not in weekly [2, 5] for hill_tbd, and no specific dates
        ts = datetime(2026, 9, 14, 10, 0)  # A Monday
        score = congestion.score_edge(normal_edge, ts, calendar=calendar)
        assert score == 0.0

    def test_chokepoint_score(self, chokepoint_edge, calendar):
        ts = datetime(2026, 9, 14, 10, 0)  # Monday, not market/festival
        score = congestion.score_edge(chokepoint_edge, ts, calendar=calendar)
        assert score >= config.CONGESTION_CHOKEPOINT

    def test_score_clamped_to_one(self, calendar):
        # Edge with all flags on + market + festival day should not exceed 1.0
        edge = {
            "osmid": "e_all_flags",
            "highway": "secondary",
            "surface": "paved",
            "is_single_lane_bridge": True,
            "is_chokepoint": True,
            "district": "hill_tbd",
        }
        ts = datetime(2026, 8, 26, 10, 0)  # Wednesday (market day for hill_tbd)
        score = congestion.score_edge(edge, ts, calendar=calendar)
        assert score <= 1.0

    def test_score_nonnegative(self, normal_edge, calendar):
        ts = datetime(2026, 9, 14, 10, 0)
        score = congestion.score_edge(normal_edge, ts, calendar=calendar)
        assert score >= 0.0

    def test_market_day_adds_score(self, normal_edge, calendar):
        # Wednesday = market day for hill_tbd
        wed = datetime(2026, 8, 26, 10, 0)
        thu = datetime(2026, 8, 27, 10, 0)
        score_wed = congestion.score_edge(normal_edge, wed, calendar=calendar)
        score_thu = congestion.score_edge(normal_edge, thu, calendar=calendar)
        assert score_wed > score_thu or score_wed >= config.CONGESTION_MARKET_DAY


class TestScoreAllEdges:
    def test_returns_dict_of_scores(self):
        import graph as gm
        path = os.path.join(
            os.path.dirname(__file__), "..", "data", "districts", "hill_district.geojson"
        )
        G = gm.load_graph_from_geojson(path)
        ts = datetime(2026, 9, 14, 10, 0)
        scores = congestion.score_all_edges(G, ts)
        assert isinstance(scores, dict)
        assert len(scores) > 0
        for k, v in scores.items():
            assert isinstance(k, str)
            assert 0.0 <= v <= 1.0

    def test_bridge_edge_has_nonzero_score(self):
        import graph as gm
        path = os.path.join(
            os.path.dirname(__file__), "..", "data", "districts", "hill_district.geojson"
        )
        G = gm.load_graph_from_geojson(path)
        ts = datetime(2026, 9, 14, 10, 0)
        scores = congestion.score_all_edges(G, ts)
        # h_e_5 is the single-lane bridge in hill_district.geojson
        assert scores.get("h_e_5", 0.0) >= config.CONGESTION_SINGLE_LANE_BRIDGE


class TestDescribeCongestionFactors:
    def test_returns_string(self, single_lane_bridge_edge):
        ts = datetime(2026, 9, 14, 10, 0)
        desc = congestion.describe_congestion_factors(
            single_lane_bridge_edge, ts, district_id="hill_tbd"
        )
        assert isinstance(desc, str)
        assert "structural proxy" in desc

    def test_includes_proxy_qualifier(self, normal_edge):
        ts = datetime(2026, 8, 26, 10, 0)  # market day
        desc = congestion.describe_congestion_factors(
            normal_edge, ts, district_id="hill_tbd"
        )
        assert "structural proxy" in desc or "no structural" in desc
