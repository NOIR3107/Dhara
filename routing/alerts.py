"""
alerts.py — Module 8: The 4 Required Alert Types
==================================================
Implements exactly four typed alerts, each with its own trigger condition
and reasoning string (via reasoning.py). No generic catch-all alert.

Alert types and their triggers:
    1. blocked_road       — edge closure probability ≥ CLOSURE_THRESHOLD
    2. inaccessible_region — alternate_route returns "no_route_available"
    3. delayed_delivery    — adjusted ETA exceeds baseline by ≥ DELAY_ALERT_THRESHOLD_MINUTES
    4. high_risk_corridor  — aggregate route risk ≥ HIGH_RISK_CORRIDOR_THRESHOLD
                             (even if no single edge is fully blocked yet)

Each checker returns:
{
    "alert_type":          "blocked_road" | "inaccessible_region" |
                            "delayed_delivery" | "high_risk_corridor",
    "location_or_edge_id": str,
    "trigger_reason":      str,
    "reasoning":           str (from reasoning.py),
    "timestamp":           ISO datetime string
}
or None if the condition is not met.

Callers (e.g. the pipeline runner) collect non-None results and forward them
to Bhoomika's display layer and Akshita's audit log.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

import config
import reasoning as rsn
from routing import RouteResult
from alternate_route import AlternateResult
from eta import ETAResult


# ---------------------------------------------------------------------------
# Type alias
# ---------------------------------------------------------------------------
Alert = Dict


# ---------------------------------------------------------------------------
# 1. Blocked Road
# ---------------------------------------------------------------------------

def check_blocked_road(
    edge_id: str,
    closure_prob: float,
    data_sources: List[str],
) -> Optional[Alert]:
    """
    Trigger when a single edge's closure probability meets or exceeds CLOSURE_THRESHOLD.

    Args:
        edge_id      : The osmid of the edge being evaluated.
        closure_prob : Closure probability (0.0–1.0) from Shriti's model
                       + field report adjustment.
        data_sources : Source labels for the reasoning string.

    Returns:
        Alert dict if triggered, None otherwise.
    """
    if closure_prob < config.CLOSURE_THRESHOLD:
        return None

    trigger_reason = (
        f"Edge '{edge_id}' closure probability {closure_prob:.2f} "
        f"≥ threshold {config.CLOSURE_THRESHOLD:.2f}"
    )

    return _build_alert(
        alert_type="blocked_road",
        location=edge_id,
        trigger_reason=trigger_reason,
        reasoning=rsn.build_alert_reasoning(
            alert_type="blocked_road",
            location=edge_id,
            trigger_value=closure_prob,
            threshold=config.CLOSURE_THRESHOLD,
            data_sources=data_sources,
        ),
    )


# ---------------------------------------------------------------------------
# 2. Inaccessible Region
# ---------------------------------------------------------------------------

def check_inaccessible_region(
    alternate_result: AlternateResult,
    data_sources: List[str],
) -> Optional[Alert]:
    """
    Trigger when alternate_route returns "no_route_available" for any village/node.
    This is the CUT-OFF state — the hardest alert to produce correctly.

    The distinction between "rerouted" and "no_route_available" must be checked
    explicitly — never assume None means cut-off.

    Args:
        alternate_result : Dict returned by alternate_route.find_alternate()
        data_sources     : Source labels for the reasoning string.

    Returns:
        Alert dict if triggered (status == "no_route_available"), None otherwise.
    """
    if alternate_result.get("status") != "no_route_available":
        return None

    blocked = alternate_result.get("blocked_edges", [])
    # Identify the unreachable location from blocked context
    # (destination not directly available here; use blocked edges as location proxy)
    location = f"destination unreachable via blocked [{', '.join(blocked[:3])}{'...' if len(blocked) > 3 else ''}]"

    trigger_reason = (
        f"No viable route available — all paths cross "
        f"{len(blocked)} blocked segment(s)"
    )

    return _build_alert(
        alert_type="inaccessible_region",
        location=location,
        trigger_reason=trigger_reason,
        reasoning=rsn.build_alert_reasoning(
            alert_type="inaccessible_region",
            location=location,
            trigger_value=float(len(blocked)),
            threshold=config.CLOSURE_THRESHOLD,
            data_sources=data_sources,
            extras={"blocked_edges": blocked},
        ),
    )


# ---------------------------------------------------------------------------
# 3. Delayed Delivery
# ---------------------------------------------------------------------------

def check_delayed_delivery(
    eta_result: ETAResult,
    data_sources: List[str],
    location: Optional[str] = None,
) -> Optional[Alert]:
    """
    Trigger when adjusted ETA exceeds baseline by ≥ DELAY_ALERT_THRESHOLD_MINUTES.

    Args:
        eta_result   : ETAResult dict from eta.compute_eta()
        data_sources : Source labels for the reasoning string.
        location     : Optional human-readable location / route label.

    Returns:
        Alert dict if triggered, None otherwise.
    """
    baseline = eta_result.get("baseline_minutes", 0.0)
    adjusted = eta_result.get("adjusted_minutes", 0.0)
    delta    = adjusted - baseline

    if delta < config.DELAY_ALERT_THRESHOLD_MINUTES:
        return None

    location_str = location or f"{eta_result.get('route_type', 'route')} route"
    trigger_reason = (
        f"Adjusted ETA {adjusted:.1f} min exceeds baseline {baseline:.1f} min "
        f"by {delta:.1f} min (threshold: {config.DELAY_ALERT_THRESHOLD_MINUTES} min)"
    )

    return _build_alert(
        alert_type="delayed_delivery",
        location=location_str,
        trigger_reason=trigger_reason,
        reasoning=rsn.build_alert_reasoning(
            alert_type="delayed_delivery",
            location=location_str,
            trigger_value=delta,
            threshold=config.DELAY_ALERT_THRESHOLD_MINUTES,
            data_sources=data_sources,
            extras={
                "baseline_minutes": baseline,
                "adjusted_minutes": adjusted,
                "delay_factors":    eta_result.get("delay_factors_applied", []),
            },
        ),
    )


# ---------------------------------------------------------------------------
# 4. High-Risk Corridor
# ---------------------------------------------------------------------------

def check_high_risk_corridor(
    route: RouteResult,
    closure_probs: Dict[str, float],
    data_sources: List[str],
) -> Optional[Alert]:
    """
    Trigger when a route's aggregate risk (mean closure probability across all edges)
    exceeds HIGH_RISK_CORRIDOR_THRESHOLD — even if no single edge is blocked yet.

    This is the early-warning alert: the corridor is risky before any edge hits
    the CLOSURE_THRESHOLD.

    Args:
        route         : RouteResult from routing.find_route()
        closure_probs : Dict[edge_osmid, probability] from Shriti's model + field reports
        data_sources  : Source labels for the reasoning string.

    Returns:
        Alert dict if triggered, None otherwise.
    """
    from alternate_route import compute_route_risk
    aggregate_risk = compute_route_risk(route, closure_probs)

    if aggregate_risk < config.HIGH_RISK_CORRIDOR_THRESHOLD:
        return None

    # Describe the corridor by its origin → destination
    origin = route.get("origin", "?")
    dest   = route.get("destination", "?")
    location = f"{origin} → {dest}"

    trigger_reason = (
        f"Aggregate corridor risk {aggregate_risk:.2f} "
        f"≥ threshold {config.HIGH_RISK_CORRIDOR_THRESHOLD:.2f} "
        f"(mean of {len(route.get('edges', []))} edge closure probabilities)"
    )

    return _build_alert(
        alert_type="high_risk_corridor",
        location=location,
        trigger_reason=trigger_reason,
        reasoning=rsn.build_alert_reasoning(
            alert_type="high_risk_corridor",
            location=location,
            trigger_value=aggregate_risk,
            threshold=config.HIGH_RISK_CORRIDOR_THRESHOLD,
            data_sources=data_sources,
        ),
    )


# ---------------------------------------------------------------------------
# Pipeline helper: run all 4 checks and return non-None results
# ---------------------------------------------------------------------------

def evaluate_all_alerts(
    route: RouteResult,
    alternate_result: AlternateResult,
    eta_result: ETAResult,
    closure_probs: Dict[str, float],
    data_sources: List[str],
) -> List[Alert]:
    """
    Convenience function — runs all 4 alert checks for a given pipeline state
    and returns a list of triggered alerts (may be empty).

    Used by the end-to-end pipeline (test_e2e.py and the live update cycle).
    """
    alerts = []

    # Alert 1: Blocked roads (one per blocked edge)
    for edge_id, prob in closure_probs.items():
        alert = check_blocked_road(edge_id, prob, data_sources)
        if alert:
            alerts.append(alert)

    # Alert 2: Inaccessible region
    alert = check_inaccessible_region(alternate_result, data_sources)
    if alert:
        alerts.append(alert)

    # Alert 3: Delayed delivery
    alert = check_delayed_delivery(eta_result, data_sources)
    if alert:
        alerts.append(alert)

    # Alert 4: High-risk corridor (uses original route, not alternate)
    alert = check_high_risk_corridor(route, closure_probs, data_sources)
    if alert:
        alerts.append(alert)

    return alerts


# ---------------------------------------------------------------------------
# Internal builder
# ---------------------------------------------------------------------------

def _build_alert(
    alert_type: str,
    location: str,
    trigger_reason: str,
    reasoning: str,
) -> Alert:
    return {
        "alert_type":          alert_type,
        "location_or_edge_id": location,
        "trigger_reason":      trigger_reason,
        "reasoning":           reasoning,
        "timestamp":           datetime.now(tz=timezone.utc).isoformat(),
    }
