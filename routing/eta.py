"""
eta.py — Module 4: ETA and Delay Calculation
=============================================
Calculates estimated travel time (ETA) for a given route under:
    - Normal / baseline conditions (from graph edge weights directly)
    - Adjusted conditions (applying rainfall, poor surface, night restriction,
      and congestion proxy multipliers from config.py)

Outputs both the normal and alternate route ETAs side by side so that
the delay delta is always explicit — callers never need to compute it.

Output structure:
{
    "route_type":            "normal" | "alternate",
    "baseline_minutes":      float,
    "adjusted_minutes":      float,
    "delay_factors_applied": ["rain", "poor_surface", "night_restriction", "congestion"]
}
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

import config
from routing import RouteResult


# ---------------------------------------------------------------------------
# Input: conditions that affect ETA
# ---------------------------------------------------------------------------

@dataclass
class ETAConditions:
    """
    Bundles all external factors that modify travel time.
    Pass one instance to compute_eta() — it never reads from environment directly.

    Args:
        rainfall_level    : 0 (none) → 3 (heavy). Mapped to ETA_RAIN_MULTIPLIER.
        is_night          : True if travel window falls in NIGHT_START_HOUR–NIGHT_END_HOUR.
        congestion_scores : Dict[edge_osmid, float] from congestion.py (0.0–1.0).
                            Used as an additive multiplier: 1.0 + score * scale_factor.
        surface_override  : Optional surface string to override graph data for testing.
    """
    rainfall_level:    int   = 0
    is_night:          bool  = False
    congestion_scores: Dict[str, float] = field(default_factory=dict)
    surface_override:  Optional[str]    = None


# ---------------------------------------------------------------------------
# Output: ETA result
# ---------------------------------------------------------------------------

ETAResult = Dict  # typed alias for the output dict


# ---------------------------------------------------------------------------
# Core calculation
# ---------------------------------------------------------------------------

def compute_eta(
    route: RouteResult,
    conditions: ETAConditions,
    route_type: str = "normal",
) -> ETAResult:
    """
    Compute baseline and adjusted ETA for a single route.

    Baseline: sum of raw travel_time_min across route edges (from graph.py weights).
    Adjusted: baseline with multiplicative delay factors applied per edge,
              then summed.

    Args:
        route      : RouteResult from routing.find_route()
        conditions : ETAConditions instance
        route_type : "normal" | "alternate" — for labelling output only

    Returns:
        ETAResult dict with baseline_minutes, adjusted_minutes, delay_factors_applied.
    """
    edges = route.get("edges", [])
    baseline_total  = 0.0
    adjusted_total  = 0.0
    factors_applied = set()

    rain_mult = config.ETA_RAIN_MULTIPLIER.get(conditions.rainfall_level, 1.0)

    for edge in edges:
        base_time = edge.get("travel_time_min", 0.0)
        baseline_total += base_time

        adjusted_time = base_time
        surface = (conditions.surface_override or edge.get("surface", "unknown")).lower()

        # --- Rain multiplier ---
        if conditions.rainfall_level > 0:
            adjusted_time *= rain_mult
            factors_applied.add("rain")

        # --- Poor surface multiplier ---
        if surface in config.POOR_SURFACE_TYPES:
            adjusted_time *= config.ETA_POOR_SURFACE_MULTIPLIER
            factors_applied.add("poor_surface")

        # --- Night restriction ---
        # Applies based on NIGHT_RESTRICTION_SCOPE:
        #   "all"          → always apply if is_night
        #   "flagged_only" → only apply if the edge's is_night_restricted flag is True
        if conditions.is_night:
            apply_night = (
                config.NIGHT_RESTRICTION_SCOPE == "all"
                or edge.get("is_night_restricted", False)
            )
            if apply_night:
                adjusted_time *= config.ETA_NIGHT_MULTIPLIER
                factors_applied.add("night_restriction")

        # --- Congestion proxy multiplier ---
        # congestion_scores are 0.0–1.0; we add them as a fractional overhead.
        # A score of 0.3 (e.g. single-lane bridge on a market day) → +30% time.
        congestion = conditions.congestion_scores.get(edge.get("osmid", ""), 0.0)
        if congestion > 0.0:
            adjusted_time *= (1.0 + congestion)
            factors_applied.add("congestion")

        adjusted_total += adjusted_time

    return {
        "route_type":            route_type,
        "baseline_minutes":      round(baseline_total, 2),
        "adjusted_minutes":      round(adjusted_total, 2),
        "delay_factors_applied": sorted(factors_applied),
    }


def compute_both_etas(
    normal_route: RouteResult,
    alternate_route: Optional[RouteResult],
    conditions: ETAConditions,
) -> Dict:
    """
    Compute ETAs for a normal and alternate route side by side.
    The delay difference (adjusted_minutes delta) is explicitly included.

    If alternate_route is None (cut-off scenario), the alternate ETA is None.

    Returns:
    {
        "normal":    ETAResult,
        "alternate": ETAResult | None,
        "delay_delta_minutes": float | None   # alternate - normal (positive = slower)
    }
    """
    normal_eta = compute_eta(normal_route, conditions, route_type="normal")

    alternate_eta = None
    delay_delta   = None

    if alternate_route is not None:
        alternate_eta = compute_eta(alternate_route, conditions, route_type="alternate")
        delay_delta = round(
            alternate_eta["adjusted_minutes"] - normal_eta["adjusted_minutes"], 2
        )

    return {
        "normal":               normal_eta,
        "alternate":            alternate_eta,
        "delay_delta_minutes":  delay_delta,
    }


# ---------------------------------------------------------------------------
# Night-window check utility (used by callers to build ETAConditions)
# ---------------------------------------------------------------------------

def is_night_travel(hour: int) -> bool:
    """
    Returns True if the given hour (0-23) falls within the configured
    night-time restriction window (config.NIGHT_START_HOUR → config.NIGHT_END_HOUR).

    Handles wrap-around windows (e.g. 20:00 → 06:00).
    """
    start = config.NIGHT_START_HOUR
    end   = config.NIGHT_END_HOUR

    if start > end:
        # Wraps midnight, e.g. 20 → 6
        return hour >= start or hour < end
    else:
        return start <= hour < end
