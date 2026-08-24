"""
tests/test_automation.py — Module 7: Three-tier confidence governance
CRITICAL: Tests exactly at and around the 0.85 and 0.60 boundaries.
"""
import os
import sys
import pytest
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import automation
import config


SOURCES = ["IMD forecast", "Bhuvan susceptibility", "2 field reports"]


class TestTierBoundaries:
    """
    Tests values at, above, and below each boundary.
    These are the hardest cases to get subtly wrong.
    """

    # -----------------------------------------------------------------------
    # AUTO_DISPATCH boundary (0.85)
    # -----------------------------------------------------------------------

    def test_confidence_just_above_auto_dispatch(self):
        result = automation.decide_action(0.851, SOURCES)
        assert result["action"] == "auto_dispatch"

    def test_confidence_at_auto_dispatch_threshold(self):
        # At exactly 0.85 → NOT auto_dispatch (threshold is strictly >, not >=)
        result = automation.decide_action(config.AUTO_DISPATCH_THRESHOLD, SOURCES)
        assert result["action"] == "act_with_override"

    def test_confidence_just_below_auto_dispatch(self):
        result = automation.decide_action(0.849, SOURCES)
        assert result["action"] == "act_with_override"

    # -----------------------------------------------------------------------
    # ACT_WITH_OVERRIDE boundary (0.60)
    # -----------------------------------------------------------------------

    def test_confidence_at_act_with_override_threshold(self):
        # At exactly 0.60 → act_with_override (threshold is >=, not >)
        result = automation.decide_action(config.ACT_WITH_OVERRIDE_THRESHOLD, SOURCES)
        assert result["action"] == "act_with_override"

    def test_confidence_just_above_act_with_override(self):
        result = automation.decide_action(0.601, SOURCES)
        assert result["action"] == "act_with_override"

    def test_confidence_just_below_act_with_override(self):
        result = automation.decide_action(0.599, SOURCES)
        assert result["action"] == "escalate"

    # -----------------------------------------------------------------------
    # Clear tier cases
    # -----------------------------------------------------------------------

    def test_high_confidence_auto_dispatch(self):
        result = automation.decide_action(0.95, SOURCES)
        assert result["action"] == "auto_dispatch"

    def test_mid_confidence_act_with_override(self):
        result = automation.decide_action(0.72, SOURCES)
        assert result["action"] == "act_with_override"

    def test_low_confidence_escalate(self):
        result = automation.decide_action(0.30, SOURCES)
        assert result["action"] == "escalate"

    def test_zero_confidence_escalate(self):
        result = automation.decide_action(0.0, SOURCES)
        assert result["action"] == "escalate"

    def test_one_confidence_auto_dispatch(self):
        result = automation.decide_action(1.0, SOURCES)
        assert result["action"] == "auto_dispatch"


class TestOutputStructure:
    def test_result_has_all_required_keys(self):
        result = automation.decide_action(0.90, SOURCES)
        assert "action"                     in result
        assert "confidence"                 in result
        assert "override_window_expires_at" in result
        assert "reasoning"                  in result

    def test_confidence_preserved_in_output(self):
        result = automation.decide_action(0.72, SOURCES)
        assert abs(result["confidence"] - 0.72) < 0.0001

    def test_auto_dispatch_no_override_window(self):
        result = automation.decide_action(0.90, SOURCES)
        assert result["override_window_expires_at"] is None

    def test_act_with_override_has_override_window(self):
        result = automation.decide_action(0.75, SOURCES)
        assert result["override_window_expires_at"] is not None
        # Should be a valid ISO datetime string
        expiry = datetime.fromisoformat(result["override_window_expires_at"])
        now = datetime.now(tz=timezone.utc)
        assert expiry > now, "Override window should be in the future"

    def test_escalate_no_override_window(self):
        result = automation.decide_action(0.45, SOURCES)
        assert result["override_window_expires_at"] is None

    def test_reasoning_nonempty_for_all_tiers(self):
        for conf in [0.90, 0.72, 0.45]:
            result = automation.decide_action(conf, SOURCES)
            assert isinstance(result["reasoning"], str)
            assert len(result["reasoning"]) > 20

    def test_escalate_reasoning_mentions_no_action(self):
        result = automation.decide_action(0.45, SOURCES)
        reasoning = result["reasoning"].lower()
        assert "no automated action" in reasoning or "human" in reasoning

    def test_override_window_duration(self):
        result = automation.decide_action(0.75, SOURCES)
        expiry = datetime.fromisoformat(result["override_window_expires_at"])
        now = datetime.now(tz=timezone.utc)
        diff_hours = (expiry - now).total_seconds() / 3600
        # Should be approximately config.OVERRIDE_WINDOW_HOURS (within 1 minute)
        assert abs(diff_hours - config.OVERRIDE_WINDOW_HOURS) < (1 / 60)


class TestGetTier:
    """Unit tests for the tier helper — used by tests and pipeline."""

    def test_get_tier_above_auto(self):
        assert automation.get_tier(0.90) == "auto_dispatch"

    def test_get_tier_at_auto_boundary(self):
        assert automation.get_tier(0.85) == "act_with_override"

    def test_get_tier_mid(self):
        assert automation.get_tier(0.72) == "act_with_override"

    def test_get_tier_at_override_boundary(self):
        assert automation.get_tier(0.60) == "act_with_override"

    def test_get_tier_below_override(self):
        assert automation.get_tier(0.59) == "escalate"

    def test_get_tier_zero(self):
        assert automation.get_tier(0.0) == "escalate"


class TestWithContext:
    def test_route_info_in_reasoning(self):
        route_info = {"origin": "A", "destination": "B", "total_time_minutes": 30, "total_distance_km": 20}
        result = automation.decide_action(0.90, SOURCES, route_info=route_info)
        assert "A" in result["reasoning"]
        assert "B" in result["reasoning"]

    def test_blocked_edges_in_escalation_reasoning(self):
        result = automation.decide_action(
            0.45, SOURCES,
            extras={"blocked_edges": ["edge_001", "edge_002"]}
        )
        assert "edge_001" in result["reasoning"] or "edge_002" in result["reasoning"]
