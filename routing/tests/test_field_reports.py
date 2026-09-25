"""
tests/test_field_reports.py — Module 9: Field report integration
CRITICAL tests:
    1. Conflicting reports LOWER confidence and FLAG segment — never silently pick one.
    2. Reports take effect IMMEDIATELY (next get_adjusted_probability call reflects them).
    3. "Blocked" report boosts probability; "clear" reduces it.
"""
import os
import sys
import pytest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import config
from field_reports import FieldReport, ReportStore, ingest_report, get_flagged_segments


@pytest.fixture
def store():
    """Fresh ReportStore for each test — isolated state."""
    return ReportStore()


@pytest.fixture
def report_blocked():
    return FieldReport(
        officer_id="officer_001",
        edge_id="h_e_5",
        status="blocked",
        district="hill_tbd",
        timestamp=datetime.now(tz=timezone.utc),
    )


@pytest.fixture
def report_clear():
    return FieldReport(
        officer_id="officer_002",
        edge_id="h_e_5",
        status="clear",
        district="hill_tbd",
        timestamp=datetime.now(tz=timezone.utc),
    )


class TestFieldReportDataclass:
    def test_valid_blocked_report(self):
        r = FieldReport(officer_id="o1", edge_id="e1", status="blocked", district="hill_tbd")
        assert r.status == "blocked"
        assert r.report_id is not None

    def test_valid_clear_report(self):
        r = FieldReport(officer_id="o1", edge_id="e1", status="clear", district="hill_tbd")
        assert r.status == "clear"

    def test_invalid_status_raises(self):
        with pytest.raises(ValueError):
            FieldReport(officer_id="o1", edge_id="e1", status="unknown", district="test")

    def test_report_ids_are_unique(self):
        r1 = FieldReport(officer_id="o1", edge_id="e1", status="blocked", district="test")
        r2 = FieldReport(officer_id="o1", edge_id="e1", status="blocked", district="test")
        assert r1.report_id != r2.report_id


class TestProbabilityAdjustment:
    def test_blocked_report_boosts_probability(self, store, report_blocked):
        base_prob = 0.5
        store.ingest(report_blocked, base_closure_prob=base_prob)
        adjusted = store.get_adjusted_probability("h_e_5", base_prob)
        assert adjusted > base_prob

    def test_clear_report_reduces_probability(self, store, report_clear):
        base_prob = 0.5
        store.ingest(report_clear, base_closure_prob=base_prob)
        adjusted = store.get_adjusted_probability("h_e_5", base_prob)
        assert adjusted < base_prob

    def test_no_report_returns_base_probability(self, store):
        adjusted = store.get_adjusted_probability("h_e_unknown", 0.65)
        assert adjusted == pytest.approx(0.65)

    def test_blocked_boost_magnitude(self, store, report_blocked):
        base_prob = 0.5
        store.ingest(report_blocked, base_closure_prob=base_prob)
        adjusted = store.get_adjusted_probability("h_e_5", base_prob)
        expected = min(base_prob + config.FIELD_REPORT_BLOCKED_BOOST, 1.0)
        assert adjusted == pytest.approx(expected, abs=0.01)

    def test_clear_reduction_magnitude(self, store, report_clear):
        base_prob = 0.5
        store.ingest(report_clear, base_closure_prob=base_prob)
        adjusted = store.get_adjusted_probability("h_e_5", base_prob)
        expected = max(base_prob - config.FIELD_REPORT_CLEAR_REDUCTION, 0.0)
        assert adjusted == pytest.approx(expected, abs=0.01)

    def test_probability_clamped_to_1(self, store):
        r = FieldReport(officer_id="o1", edge_id="e1", status="blocked", district="test")
        store.ingest(r, base_closure_prob=0.95)
        adjusted = store.get_adjusted_probability("e1", 0.95)
        assert adjusted <= 1.0

    def test_probability_clamped_to_0(self, store):
        r = FieldReport(officer_id="o1", edge_id="e1", status="clear", district="test")
        store.ingest(r, base_closure_prob=0.02)
        adjusted = store.get_adjusted_probability("e1", 0.02)
        assert adjusted >= 0.0

    def test_effect_is_immediate(self, store, report_blocked):
        """
        CRITICAL: After ingest, get_adjusted_probability must reflect the
        report immediately — not after a delay or update cycle.
        """
        base_prob = 0.5
        before = store.get_adjusted_probability("h_e_5", base_prob)
        store.ingest(report_blocked, base_closure_prob=base_prob)
        after = store.get_adjusted_probability("h_e_5", base_prob)
        # Blocked report should have increased the probability
        assert after > before, (
            "Field report must take effect IMMEDIATELY — "
            f"before={before}, after={after}"
        )


class TestSeverityAwareBoost:
    """
    field_report_nlp.py classifies the officer's free-text notes into a
    hazard severity, and get_adjusted_probability() should look up a
    severity-specific boost instead of always using the flat
    FIELD_REPORT_BLOCKED_BOOST — see config.FIELD_REPORT_SEVERITY_BOOST.
    """

    def test_no_notes_falls_back_to_flat_boost(self, store):
        """A report with no notes has severity 'none', which maps to the
        original flat FIELD_REPORT_BLOCKED_BOOST — unchanged behavior."""
        r = FieldReport(officer_id="o1", edge_id="e_no_notes", status="blocked", district="test")
        store.ingest(r, base_closure_prob=0.5)
        adjusted = store.get_adjusted_probability("e_no_notes", 0.5)
        expected = min(0.5 + config.FIELD_REPORT_BLOCKED_BOOST, 1.0)
        assert adjusted == pytest.approx(expected, abs=0.01)

    def test_impassable_note_boosts_more_than_flat_default(self, store):
        r = FieldReport(
            officer_id="o1", edge_id="e_impassable", status="blocked", district="test",
            notes="Landslide near km 12, road fully buried under debris, no vehicle can pass",
        )
        assert r.hazard_type == "landslide"
        assert r.severity == "impassable"
        store.ingest(r, base_closure_prob=0.5)
        adjusted = store.get_adjusted_probability("e_impassable", 0.5)
        expected = min(0.5 + config.FIELD_REPORT_SEVERITY_BOOST["impassable"], 1.0)
        assert adjusted == pytest.approx(expected, abs=0.01)
        assert config.FIELD_REPORT_SEVERITY_BOOST["impassable"] > config.FIELD_REPORT_BLOCKED_BOOST

    def test_minor_note_boosts_less_than_flat_default(self, store):
        r = FieldReport(
            officer_id="o1", edge_id="e_minor", status="blocked", district="test",
            notes="Small branches down after wind, cleared easily by passing vehicles",
        )
        assert r.severity == "minor"
        store.ingest(r, base_closure_prob=0.5)
        adjusted = store.get_adjusted_probability("e_minor", 0.5)
        expected = min(0.5 + config.FIELD_REPORT_SEVERITY_BOOST["minor"], 1.0)
        assert adjusted == pytest.approx(expected, abs=0.01)
        assert config.FIELD_REPORT_SEVERITY_BOOST["minor"] < config.FIELD_REPORT_BLOCKED_BOOST

    def test_reasoning_mentions_nlp_classification(self, store):
        r = FieldReport(
            officer_id="o1", edge_id="e_reason", status="blocked", district="test",
            notes="Bridge deck washed away in flash flood, route completely severed",
        )
        result = store.ingest(r, base_closure_prob=0.5)
        assert "washout" in result["reasoning"]
        assert result["hazard_type"] == "washout"
        assert result["severity"] == "impassable"


class TestConflictDetection:
    """
    CRITICAL: Conflicting reports must lower confidence and flag for human review.
    Never silently pick one report over the other.
    """

    def test_conflict_detected_within_window(self, store, report_blocked, report_clear):
        """Both reports within conflict window with different statuses → conflict."""
        store.ingest(report_blocked, base_closure_prob=0.5)
        result = store.ingest(report_clear, base_closure_prob=0.5)
        assert result["is_conflict"] is True

    def test_conflict_flags_segment_for_review(self, store, report_blocked, report_clear):
        store.ingest(report_blocked, base_closure_prob=0.5)
        store.ingest(report_clear, base_closure_prob=0.5)
        assert "h_e_5" in store.get_flagged_segments()

    def test_conflict_lowers_confidence_via_probability(self, store, report_blocked, report_clear):
        """
        After a conflict, the adjusted probability should be pulled toward 0.5
        (higher uncertainty) compared to a non-conflicted state.
        """
        base_prob = 0.9
        # Non-conflicted: only blocked report → close to 1.0
        store_clean = ReportStore()
        store_clean.ingest(report_blocked, base_closure_prob=base_prob)
        prob_no_conflict = store_clean.get_adjusted_probability("h_e_5", base_prob)

        # Conflicted: both reports → pulled toward 0.5
        store.ingest(report_blocked, base_closure_prob=base_prob)
        store.ingest(report_clear, base_closure_prob=base_prob)
        prob_conflict = store.get_adjusted_probability("h_e_5", base_prob)

        # Conflict should reduce probability toward 0.5 (less extreme)
        assert prob_conflict < prob_no_conflict, (
            f"Conflict should lower probability: conflict={prob_conflict}, "
            f"no_conflict={prob_no_conflict}"
        )

    def test_both_reports_preserved_after_conflict(self, store, report_blocked, report_clear):
        """Both reports must be stored — conflict does not delete either one."""
        store.ingest(report_blocked, base_closure_prob=0.5)
        store.ingest(report_clear, base_closure_prob=0.5)
        all_reports = store.get_all_reports("h_e_5")
        assert len(all_reports) == 2
        statuses = {r.status for r in all_reports}
        assert "blocked" in statuses
        assert "clear"   in statuses

    def test_no_conflict_same_status(self, store):
        """Two reports with the same status should NOT trigger a conflict."""
        r1 = FieldReport(officer_id="o1", edge_id="e_test", status="blocked", district="test")
        r2 = FieldReport(officer_id="o2", edge_id="e_test", status="blocked", district="test")
        store.ingest(r1, base_closure_prob=0.5)
        result = store.ingest(r2, base_closure_prob=0.5)
        assert result["is_conflict"] is False
        assert "e_test" not in store.get_flagged_segments()

    def test_no_conflict_outside_window(self, store):
        """Two conflicting reports OUTSIDE the conflict window should not trigger conflict."""
        old_timestamp = datetime.now(tz=timezone.utc) - timedelta(
            minutes=config.FIELD_REPORT_CONFLICT_WINDOW_MINUTES + 5
        )
        r_old = FieldReport(
            officer_id="o1", edge_id="e_window_test",
            status="blocked", district="test",
            timestamp=old_timestamp,
        )
        r_new = FieldReport(
            officer_id="o2", edge_id="e_window_test",
            status="clear", district="test",
            timestamp=datetime.now(tz=timezone.utc),
        )
        store.ingest(r_old, base_closure_prob=0.5)
        result = store.ingest(r_new, base_closure_prob=0.5)
        assert result["is_conflict"] is False

    def test_conflict_reasoning_mentions_conflict(self, store, report_blocked, report_clear):
        store.ingest(report_blocked, base_closure_prob=0.5)
        result = store.ingest(report_clear, base_closure_prob=0.5)
        assert "CONFLICT" in result["reasoning"]

    def test_conflict_reasoning_mentions_human_review(self, store, report_blocked, report_clear):
        store.ingest(report_blocked, base_closure_prob=0.5)
        result = store.ingest(report_clear, base_closure_prob=0.5)
        reasoning_lower = result["reasoning"].lower()
        assert "human" in reasoning_lower or "review" in reasoning_lower


class TestBuildAdjustedProbsDict:
    def test_returns_dict_covering_all_base_edges(self, store):
        base_probs = {"e1": 0.3, "e2": 0.6, "e3": 0.8}
        adjusted = store.build_adjusted_probs_dict(base_probs)
        assert set(adjusted.keys()) == set(base_probs.keys())

    def test_adjusted_values_in_range(self, store):
        base_probs = {"e1": 0.5, "e2": 0.5}
        r = FieldReport(officer_id="o1", edge_id="e1", status="blocked", district="test")
        store.ingest(r, base_closure_prob=0.5)
        adjusted = store.build_adjusted_probs_dict(base_probs)
        for v in adjusted.values():
            assert 0.0 <= v <= 1.0


class TestClearFlag:
    def test_clear_flag_removes_from_flagged(self, store, report_blocked, report_clear):
        store.ingest(report_blocked, base_closure_prob=0.5)
        store.ingest(report_clear, base_closure_prob=0.5)
        assert "h_e_5" in store.get_flagged_segments()
        store.clear_flag("h_e_5", clearing_officer_id="supervisor_001")
        assert "h_e_5" not in store.get_flagged_segments()

    def test_reports_preserved_after_flag_clear(self, store, report_blocked, report_clear):
        """Clearing a flag does NOT delete the reports (audit trail preserved)."""
        store.ingest(report_blocked, base_closure_prob=0.5)
        store.ingest(report_clear, base_closure_prob=0.5)
        store.clear_flag("h_e_5", clearing_officer_id="supervisor_001")
        assert len(store.get_all_reports("h_e_5")) == 2


class TestConvenienceFunctions:
    def test_ingest_report_function(self):
        """Module-level singleton store — tests convenience wrapper."""
        import field_reports as fr
        # Reset the module-level store for isolation
        fr._store = ReportStore()

        result = ingest_report(
            officer_id="officer_007",
            edge_id="e_convenience_test",
            status="blocked",
            district="test_district",
            base_closure_prob=0.4,
        )
        assert result["status"] == "blocked"
        assert result["edge_id"] == "e_convenience_test"
        assert result["adjusted_probability"] > 0.4

    def test_get_flagged_segments_function(self):
        import field_reports as fr
        fr._store = ReportStore()
        r1 = FieldReport(officer_id="o1", edge_id="e_flag_test", status="blocked", district="test")
        r2 = FieldReport(officer_id="o2", edge_id="e_flag_test", status="clear", district="test")
        fr._store.ingest(r1, base_closure_prob=0.5)
        fr._store.ingest(r2, base_closure_prob=0.5)
        flagged = get_flagged_segments()
        assert "e_flag_test" in flagged
