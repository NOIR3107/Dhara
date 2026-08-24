"""
tests/test_reasoning.py — Module 6: Template-based reasoning strings
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import reasoning as rsn
import config


class TestBuildReasoning:
    def test_auto_dispatch_contains_tier_label(self):
        result = rsn.build_reasoning(
            action="auto_dispatch",
            confidence=0.90,
            data_sources=["IMD forecast", "Bhuvan susceptibility", "2 field reports"],
        )
        assert isinstance(result, str)
        assert "auto-dispatch" in result.lower() or "auto_dispatch" in result.lower() or "auto" in result.lower()
        assert "0.90" in result

    def test_act_with_override_contains_override_reference(self):
        result = rsn.build_reasoning(
            action="act_with_override",
            confidence=0.75,
            data_sources=["IMD forecast"],
        )
        assert "override" in result.lower()
        assert "0.75" in result

    def test_escalate_contains_escalation_text(self):
        result = rsn.build_reasoning(
            action="escalate",
            confidence=0.45,
            data_sources=["field report only"],
        )
        assert "escalate" in result.lower() or "human" in result.lower()
        assert "0.45" in result

    def test_data_sources_in_output(self):
        sources = ["IMD forecast", "Bhuvan", "3 field reports"]
        result = rsn.build_reasoning(
            action="auto_dispatch",
            confidence=0.90,
            data_sources=sources,
        )
        for src in sources:
            assert src in result, f"Source '{src}' missing from reasoning string"

    def test_route_info_included_when_provided(self):
        route_info = {
            "origin": "VillageA",
            "destination": "VillageB",
            "total_time_minutes": 45.0,
            "total_distance_km": 30.0,
        }
        result = rsn.build_reasoning(
            action="auto_dispatch",
            confidence=0.90,
            data_sources=["test"],
            route_info=route_info,
        )
        assert "VillageA" in result
        assert "VillageB" in result

    def test_blocked_edges_included_in_extras(self):
        result = rsn.build_reasoning(
            action="act_with_override",
            confidence=0.70,
            data_sources=["test"],
            extras={"blocked_edges": ["e1", "e2", "e3"]},
        )
        assert "e1" in result

    def test_no_empty_string_returned(self):
        for action in ["auto_dispatch", "act_with_override", "escalate"]:
            result = rsn.build_reasoning(action=action, confidence=0.5, data_sources=["test"])
            assert result.strip() != ""


class TestBuildAlertReasoning:
    def test_blocked_road(self):
        result = rsn.build_alert_reasoning(
            alert_type="blocked_road",
            location="edge_h_e_5",
            trigger_value=0.85,
            threshold=config.CLOSURE_THRESHOLD,
            data_sources=["model", "field report"],
        )
        assert "BLOCKED ROAD" in result
        assert "edge_h_e_5" in result
        assert "0.85" in result

    def test_inaccessible_region(self):
        result = rsn.build_alert_reasoning(
            alert_type="inaccessible_region",
            location="VillageD",
            trigger_value=2.0,
            threshold=config.CLOSURE_THRESHOLD,
            data_sources=["model"],
            extras={"blocked_edges": ["e_spur", "e_spur_rev"]},
        )
        assert "INACCESSIBLE" in result or "CUT OFF" in result
        assert "VillageD" in result

    def test_delayed_delivery(self):
        result = rsn.build_alert_reasoning(
            alert_type="delayed_delivery",
            location="Route A-B",
            trigger_value=45.0,
            threshold=config.DELAY_ALERT_THRESHOLD_MINUTES,
            data_sources=["eta_calculation"],
            extras={"baseline_minutes": 30.0, "adjusted_minutes": 75.0, "delay_factors": ["rain", "poor_surface"]},
        )
        assert "DELAYED" in result
        assert "rain" in result

    def test_high_risk_corridor(self):
        result = rsn.build_alert_reasoning(
            alert_type="high_risk_corridor",
            location="A → D",
            trigger_value=0.55,
            threshold=config.HIGH_RISK_CORRIDOR_THRESHOLD,
            data_sources=["model"],
        )
        assert "HIGH-RISK" in result or "HIGH_RISK" in result.upper()
        assert "A → D" in result

    def test_all_alert_types_return_nonempty(self):
        for at in ["blocked_road", "inaccessible_region", "delayed_delivery", "high_risk_corridor"]:
            result = rsn.build_alert_reasoning(
                alert_type=at,
                location="test_location",
                trigger_value=0.8,
                threshold=0.5,
                data_sources=["test"],
            )
            assert result.strip() != ""


class TestBuildEscalationReasoning:
    def test_contains_confidence_and_threshold(self):
        result = rsn.build_escalation_reasoning(
            confidence=0.45,
            route_info={"origin": "A", "destination": "B"},
            blocked_edges=["e1"],
            data_sources=["model"],
        )
        assert "0.45" in result
        assert str(config.ACT_WITH_OVERRIDE_THRESHOLD) in result

    def test_no_automated_action_stated(self):
        result = rsn.build_escalation_reasoning(
            confidence=0.30,
            route_info=None,
            blocked_edges=[],
            data_sources=["test"],
        )
        assert "no automated action" in result.lower() or "human" in result.lower()


class TestBuildNoRouteReasoning:
    def test_mentions_origin_and_destination(self):
        result = rsn.build_no_route_reasoning(
            origin="VillageA",
            destination="VillageD",
            blocked_edges=["e_spur"],
            data_sources=["model", "field report"],
        )
        assert "VillageA" in result
        assert "VillageD" in result

    def test_mentions_cutoff(self):
        result = rsn.build_no_route_reasoning(
            origin="A", destination="D",
            blocked_edges=["e_spur"],
            data_sources=["test"],
        )
        assert "CUT-OFF" in result or "inaccessible" in result.lower()


class TestBuildFieldReportReasoning:
    def test_no_conflict(self):
        result = rsn.build_field_report_reasoning(
            edge_id="h_e_5",
            report_status="blocked",
            officer_id="officer_001",
            adjusted_probability=0.85,
            data_sources=["field_report"],
            is_conflict=False,
        )
        assert "h_e_5" in result
        assert "officer_001" in result
        assert "0.85" in result

    def test_conflict_flag_in_output(self):
        result = rsn.build_field_report_reasoning(
            edge_id="h_e_5",
            report_status="blocked",
            officer_id="officer_001",
            adjusted_probability=0.65,
            data_sources=["field_report"],
            is_conflict=True,
            conflict_detail="Officers disagree on status",
        )
        assert "CONFLICT" in result
        assert "human" in result.lower() or "review" in result.lower()
