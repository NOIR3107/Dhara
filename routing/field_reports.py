"""
field_reports.py — Module 9: Field-Report Integration
=======================================================
Ingests road status reports from field officers (via Bhoomika's app)
and integrates them as corroborating signals into the closure probability
values used by alternate_route.py and automation.py.

Key design rules:
    - A "blocked" report BOOSTS the edge's effective closure probability.
    - A "clear" report REDUCES it.
    - Two conflicting reports for the same edge within the conflict window
      LOWER confidence and FLAG for human review — never silently pick one.
    - Reports take effect IMMEDIATELY on ingest (next call to
      get_adjusted_probability reflects it).
    - Update cycle: defined as config.UPDATE_CYCLE_MINUTES. Field reports
      are reflected in the very next cycle.

Conflict detection:
    - If two reports on the same edge within FIELD_REPORT_CONFLICT_WINDOW_MINUTES
      have different statuses ("blocked" vs "clear"), that is a conflict.
    - Confidence is reduced by FIELD_REPORT_CONFLICT_CONFIDENCE_PENALTY.
    - The segment is added to the flagged-for-review set.
    - Both reports are preserved — the conflict is logged, not resolved.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set

import config
import reasoning as rsn


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class FieldReport:
    """
    A single field report from an officer.

    Attributes:
        report_id  : Auto-generated UUID.
        officer_id : Officer identifier (from Bhoomika's app).
        edge_id    : osmid of the road segment being reported on.
        status     : "blocked" | "clear"
        timestamp  : When the report was submitted (UTC datetime).
        district   : The district_id of the reported segment.
        notes      : Optional free-text notes from the officer.
    """
    officer_id: str
    edge_id:    str
    status:     str                # "blocked" | "clear"
    district:   str
    timestamp:  datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))
    notes:      Optional[str] = None
    report_id:  str = field(default_factory=lambda: str(uuid.uuid4()))

    def __post_init__(self):
        if self.status not in ("blocked", "clear"):
            raise ValueError(f"FieldReport status must be 'blocked' or 'clear', got: '{self.status}'")


@dataclass
class ConflictResult:
    """
    Produced when two conflicting reports are detected for the same edge.
    Never auto-resolved — always flagged for human review.
    """
    edge_id:              str
    report_a:             FieldReport
    report_b:             FieldReport
    confidence_penalty:   float
    detail:               str
    reasoning:            str


# ---------------------------------------------------------------------------
# Report store
# ---------------------------------------------------------------------------

class ReportStore:
    """
    In-memory store for field reports with conflict detection and
    probability adjustment logic.

    Thread-safety: not guaranteed in this implementation.
    For production, replace the underlying dicts with Redis or SQLite
    — all calling code goes through this class interface, so no other
    module needs to change.
    """

    def __init__(self):
        # edge_id → list of FieldReport (chronological)
        self._reports: Dict[str, List[FieldReport]] = {}
        # edge_id → ConflictResult (if a conflict is active)
        self._conflicts: Dict[str, ConflictResult] = {}
        # edge_id → confidence penalty from conflicts (0.0–1.0)
        self._confidence_penalties: Dict[str, float] = {}
        # set of edge_ids flagged for human review
        self._flagged: Set[str] = set()

    # -----------------------------------------------------------------------
    # Ingest
    # -----------------------------------------------------------------------

    def ingest(
        self,
        report: FieldReport,
        base_closure_prob: float = 0.0,
        data_sources: Optional[List[str]] = None,
    ) -> dict:
        """
        Ingest a new field report.

        - Updates the stored list for the edge immediately.
        - Checks for conflict with recent reports.
        - Returns a summary dict including:
            adjusted_probability, is_conflict, reasoning, flagged_for_review.

        Effect is IMMEDIATE — get_adjusted_probability() reflects this report
        on its very next call (within the same update cycle).

        Args:
            report            : The FieldReport to ingest.
            base_closure_prob : The current model closure probability for this edge.
            data_sources      : Source labels for reasoning string.
        """
        data_sources = data_sources or ["field_report"]
        edge_id = report.edge_id

        # Store report
        if edge_id not in self._reports:
            self._reports[edge_id] = []
        self._reports[edge_id].append(report)

        # Detect conflict
        conflict = self._detect_conflict(edge_id, report)
        is_conflict = conflict is not None

        if is_conflict:
            self._conflicts[edge_id] = conflict
            self._confidence_penalties[edge_id] = config.FIELD_REPORT_CONFLICT_CONFIDENCE_PENALTY
            self._flagged.add(edge_id)

        # Compute adjusted probability
        adjusted_prob = self.get_adjusted_probability(edge_id, base_closure_prob)

        # Build reasoning string
        reason = rsn.build_field_report_reasoning(
            edge_id=edge_id,
            report_status=report.status,
            officer_id=report.officer_id,
            adjusted_probability=adjusted_prob,
            data_sources=data_sources,
            is_conflict=is_conflict,
            conflict_detail=conflict.detail if conflict else None,
        )

        return {
            "report_id":            report.report_id,
            "edge_id":              edge_id,
            "status":               report.status,
            "adjusted_probability": round(adjusted_prob, 4),
            "is_conflict":          is_conflict,
            "flagged_for_review":   edge_id in self._flagged,
            "reasoning":            reason,
        }

    # -----------------------------------------------------------------------
    # Conflict detection
    # -----------------------------------------------------------------------

    def _detect_conflict(
        self,
        edge_id: str,
        new_report: FieldReport,
    ) -> Optional[ConflictResult]:
        """
        Check whether the new report conflicts with any existing report
        on the same edge within the conflict window.

        Conflict = two reports with different statuses within
        config.FIELD_REPORT_CONFLICT_WINDOW_MINUTES.

        Returns ConflictResult if conflict detected, None otherwise.
        NEVER picks one report over the other — both are preserved.
        """
        window = timedelta(minutes=config.FIELD_REPORT_CONFLICT_WINDOW_MINUTES)
        cutoff = new_report.timestamp - window

        recent = [
            r for r in self._reports.get(edge_id, [])
            if r.timestamp >= cutoff and r.report_id != new_report.report_id
        ]

        for existing_report in recent:
            if existing_report.status != new_report.status:
                detail = (
                    f"Officer '{existing_report.officer_id}' reported '{existing_report.status}' "
                    f"at {existing_report.timestamp.isoformat()}, "
                    f"but officer '{new_report.officer_id}' reported '{new_report.status}' "
                    f"at {new_report.timestamp.isoformat()} "
                    f"(within {config.FIELD_REPORT_CONFLICT_WINDOW_MINUTES}-min conflict window)"
                )

                reason = rsn.build_field_report_reasoning(
                    edge_id=edge_id,
                    report_status=new_report.status,
                    officer_id=new_report.officer_id,
                    adjusted_probability=0.0,  # will be updated by caller
                    data_sources=["field_report_conflict"],
                    is_conflict=True,
                    conflict_detail=detail,
                )

                return ConflictResult(
                    edge_id=edge_id,
                    report_a=existing_report,
                    report_b=new_report,
                    confidence_penalty=config.FIELD_REPORT_CONFLICT_CONFIDENCE_PENALTY,
                    detail=detail,
                    reasoning=reason,
                )

        return None

    # -----------------------------------------------------------------------
    # Probability adjustment
    # -----------------------------------------------------------------------

    def get_adjusted_probability(
        self,
        edge_id: str,
        base_prob: float,
    ) -> float:
        """
        Blend the field report signal with the model's base closure probability.

        Rules:
            - Most recent report wins for direction (blocked→boost, clear→reduce).
            - If a conflict exists for this edge, apply confidence penalty as an
              additional uncertainty factor (average toward 0.5).
            - Result is clamped to [0.0, 1.0].

        This method is called by the pipeline to get the effective probability
        to pass to alternate_route.py and automation.py.
        """
        reports = self._reports.get(edge_id, [])
        if not reports:
            return base_prob

        # Most recent report
        latest = max(reports, key=lambda r: r.timestamp)

        if latest.status == "blocked":
            adjusted = min(base_prob + config.FIELD_REPORT_BLOCKED_BOOST, 1.0)
        else:  # "clear"
            adjusted = max(base_prob - config.FIELD_REPORT_CLEAR_REDUCTION, 0.0)

        # If conflict: blend toward 0.5 by the penalty amount (more uncertainty)
        if edge_id in self._flagged:
            penalty = self._confidence_penalties.get(edge_id, 0.0)
            # Pull the adjusted value toward 0.5 proportional to the penalty
            adjusted = adjusted + penalty * (0.5 - adjusted)

        return round(min(max(adjusted, 0.0), 1.0), 4)

    # -----------------------------------------------------------------------
    # Queries
    # -----------------------------------------------------------------------

    def get_flagged_segments(self) -> List[str]:
        """
        Return all edge IDs currently flagged for human review due to conflicting reports.
        """
        return sorted(self._flagged)

    def get_active_conflict(self, edge_id: str) -> Optional[ConflictResult]:
        """Return the active ConflictResult for an edge, or None."""
        return self._conflicts.get(edge_id)

    def get_all_reports(self, edge_id: str) -> List[FieldReport]:
        """Return all reports for an edge (chronological order)."""
        return list(self._reports.get(edge_id, []))

    def get_report_count(self, edge_id: str) -> int:
        """Return the number of reports received for an edge."""
        return len(self._reports.get(edge_id, []))

    def clear_flag(self, edge_id: str, clearing_officer_id: str):
        """
        Clear the human-review flag for a segment (call after a human has reviewed it).
        Does NOT delete the reports — they remain in the audit trail.
        """
        self._flagged.discard(edge_id)
        if edge_id in self._conflicts:
            del self._conflicts[edge_id]
        if edge_id in self._confidence_penalties:
            del self._confidence_penalties[edge_id]

    def build_adjusted_probs_dict(
        self,
        base_closure_probs: Dict[str, float],
    ) -> Dict[str, float]:
        """
        Build a complete adjusted closure probability dict for ALL edges,
        incorporating field report signals. Returns a new dict.

        This is the output that alternate_route.py and automation.py consume
        after each update cycle.
        """
        adjusted = {}
        for edge_id, base_prob in base_closure_probs.items():
            adjusted[edge_id] = self.get_adjusted_probability(edge_id, base_prob)
        return adjusted


# ---------------------------------------------------------------------------
# Module-level singleton store
# ---------------------------------------------------------------------------
# The store is module-level so that field reports persist across the update cycle.
# Replace this with a DB-backed store for production multi-process deployments.

_store = ReportStore()


def get_store() -> ReportStore:
    """Return the module-level singleton ReportStore."""
    return _store


# ---------------------------------------------------------------------------
# Convenience top-level functions (thin wrappers over the store)
# ---------------------------------------------------------------------------

def ingest_report(
    officer_id: str,
    edge_id: str,
    status: str,
    district: str,
    base_closure_prob: float = 0.0,
    data_sources: Optional[List[str]] = None,
    notes: Optional[str] = None,
    timestamp: Optional[datetime] = None,
) -> dict:
    """
    Convenience function to create and ingest a FieldReport in one call.
    Returns the ingest summary dict.
    """
    report = FieldReport(
        officer_id=officer_id,
        edge_id=edge_id,
        status=status,
        district=district,
        notes=notes,
        timestamp=timestamp or datetime.now(tz=timezone.utc),
    )
    return _store.ingest(report, base_closure_prob=base_closure_prob, data_sources=data_sources)


def get_adjusted_probability(edge_id: str, base_prob: float) -> float:
    """Convenience wrapper over the module-level store."""
    return _store.get_adjusted_probability(edge_id, base_prob)


def get_flagged_segments() -> List[str]:
    """Convenience wrapper over the module-level store."""
    return _store.get_flagged_segments()
