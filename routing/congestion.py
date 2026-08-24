"""
congestion.py — Module 5: Structural Congestion Proxy
======================================================
IMPORTANT — THIS IS A PROXY, NOT LIVE TRAFFIC DATA.
=====================================================
NER rural roads have no live traffic feed. This module produces a structural
congestion proxy score per edge and time-window based on known bottleneck types:

    - Single-lane bridges (physical chokepoint, always present)
    - Chokepoint-flagged segments (from GeoJSON properties)
    - Weekly market days per district (from congestion_calendar.yaml)
    - Festival / event days per district (from congestion_calendar.yaml)

These are STRUCTURAL signals — they reflect known patterns, not observed traffic.
This score is fed into eta.py as the "congestion" delay factor.

Any generated reasoning strings that cite congestion scores MUST include the
qualifier "structural proxy (no live traffic feed)" — enforced here and in
reasoning.py templates.

Score per edge: float in [0.0, 1.0] (clamped), additive combination of factors.
"""

from __future__ import annotations

import os
from datetime import date, datetime
from typing import Dict, Optional

import yaml
import networkx as nx

import config


# ---------------------------------------------------------------------------
# Congestion Calendar
# ---------------------------------------------------------------------------

class CongestionCalendar:
    """
    Loads and queries the congestion calendar from config.CONGESTION_CALENDAR_PATH.
    Provides methods to check market days, festival days, and global holidays.

    The YAML format is fully documented in data/congestion_calendar.yaml.
    Swapping the YAML file updates the calendar with zero code changes.
    """

    def __init__(self, calendar_path: Optional[str] = None):
        path = calendar_path or config.CONGESTION_CALENDAR_PATH
        if not os.path.exists(path):
            print(f"[congestion.py] WARNING: Calendar file not found: {path}. "
                  f"Congestion calendar features will be disabled.")
            self._data = {}
        else:
            with open(path, "r", encoding="utf-8") as f:
                self._data = yaml.safe_load(f) or {}

    def is_market_day(self, district_id: str, query_date: date) -> bool:
        """
        Returns True if query_date is a market day for the given district.
        Checks both weekly recurring days and specific dates.
        """
        district_data = self._data.get("districts", {}).get(district_id, {})
        market_days   = district_data.get("market_days", {})

        # Weekly recurring market days (0=Monday, 6=Sunday)
        weekly = market_days.get("weekly", [])
        if query_date.weekday() in weekly:
            return True

        # Specific dates
        specific_dates = [
            datetime.strptime(d, "%Y-%m-%d").date()
            for d in market_days.get("dates", [])
        ]
        return query_date in specific_dates

    def is_festival_day(self, district_id: str, query_date: date) -> bool:
        """
        Returns True if query_date is a festival day for the given district
        or a global festival day affecting all districts.
        """
        # Global festival days
        global_days = [
            datetime.strptime(d, "%Y-%m-%d").date()
            for d in self._data.get("global_festival_days", [])
        ]
        if query_date in global_days:
            return True

        # District-specific festival days
        district_data  = self._data.get("districts", {}).get(district_id, {})
        festival_days  = district_data.get("festival_days", {})

        specific_dates = [
            datetime.strptime(d, "%Y-%m-%d").date()
            for d in festival_days.get("dates", [])
        ]
        if query_date in specific_dates:
            return True

        # Recurring monthly festival days (e.g. every 1st of the month)
        recurring = festival_days.get("recurring_monthly", [])
        if query_date.day in recurring:
            return True

        return False


# Module-level calendar instance (loaded once)
_calendar: Optional[CongestionCalendar] = None


def get_calendar() -> CongestionCalendar:
    global _calendar
    if _calendar is None:
        _calendar = CongestionCalendar()
    return _calendar


# ---------------------------------------------------------------------------
# Per-edge scoring
# ---------------------------------------------------------------------------

def score_edge(
    edge_data: dict,
    timestamp: datetime,
    district_id: Optional[str] = None,
    calendar: Optional[CongestionCalendar] = None,
) -> float:
    """
    Compute the structural congestion proxy score for a single edge.

    Score is the sum of applicable factor contributions (from config.py),
    clamped to [0.0, 1.0]. A score of 0.3 means ~30% additional travel time
    when fed into eta.py.

    Args:
        edge_data   : The edge attribute dict from the NetworkX graph.
        timestamp   : The datetime of the travel window being evaluated.
        district_id : The district_id to use for calendar lookups.
                      Falls back to edge_data["district"] if not provided.
        calendar    : CongestionCalendar instance (uses module-level if None).

    Returns:
        float in [0.0, 1.0]
    """
    if calendar is None:
        calendar = get_calendar()

    score     = 0.0
    query_date = timestamp.date()
    did = district_id or edge_data.get("district", "")

    # --- Single-lane bridge ---
    if edge_data.get("is_single_lane_bridge", False):
        score += config.CONGESTION_SINGLE_LANE_BRIDGE

    # --- Chokepoint segment ---
    if edge_data.get("is_chokepoint", False):
        score += config.CONGESTION_CHOKEPOINT

    # --- Market day ---
    if did and calendar.is_market_day(did, query_date):
        score += config.CONGESTION_MARKET_DAY

    # --- Festival day ---
    if did and calendar.is_festival_day(did, query_date):
        score += config.CONGESTION_FESTIVAL_DAY

    # Clamp to [0.0, 1.0]
    return min(score, 1.0)


# ---------------------------------------------------------------------------
# All-edges scoring (produces the dict consumed by eta.py)
# ---------------------------------------------------------------------------

def score_all_edges(
    graph: nx.MultiDiGraph,
    timestamp: Optional[datetime] = None,
    calendar: Optional[CongestionCalendar] = None,
) -> Dict[str, float]:
    """
    Score all edges in the graph for the given timestamp.
    Returns a dict: { edge_osmid → congestion_score (0.0–1.0) }.

    This dict is passed directly to eta.ETAConditions.congestion_scores.

    Note: For MultiDiGraph, both directions of a road share the same osmid
    in our schema (forward = osmid, reverse = osmid + "_rev"). We score by
    the base osmid so eta.py can look up by the osmid stored in route edges.
    """
    if timestamp is None:
        timestamp = datetime.now()
    if calendar is None:
        calendar = get_calendar()

    scores: Dict[str, float] = {}

    seen_osmids = set()
    for u, v, key, data in graph.edges(keys=True, data=True):
        osmid = str(data.get("osmid", f"{u}-{v}"))
        # Score each physical road segment once (skip reverse duplicates)
        base_osmid = osmid.replace("_rev", "")
        if base_osmid in seen_osmids:
            continue
        seen_osmids.add(base_osmid)

        district_id = data.get("district", "")
        score = score_edge(data, timestamp, district_id=district_id, calendar=calendar)
        scores[base_osmid] = score

    return scores


# ---------------------------------------------------------------------------
# Human-readable congestion label (for reasoning strings)
# ---------------------------------------------------------------------------

def describe_congestion_factors(edge_data: dict, timestamp: datetime, district_id: str = "") -> str:
    """
    Return a comma-separated string of active congestion factors for an edge.
    Used by reasoning.py to build explanation strings.
    Includes the required 'structural proxy' qualifier.
    """
    factors = []
    calendar = get_calendar()
    did = district_id or edge_data.get("district", "")
    query_date = timestamp.date()

    if edge_data.get("is_single_lane_bridge", False):
        factors.append("single-lane bridge")
    if edge_data.get("is_chokepoint", False):
        factors.append("known chokepoint")
    if did and calendar.is_market_day(did, query_date):
        factors.append("market day")
    if did and calendar.is_festival_day(did, query_date):
        factors.append("festival day")

    if not factors:
        return "no structural congestion factors active"
    return f"structural proxy (no live traffic feed): {', '.join(factors)}"
