"""
reasoning.py — Module 6: Explanation Generator
================================================
Single shared module that EVERY automated action calls to produce its
explanation string. Consumed by:
    - automation.py  (tier decision explanation)
    - alerts.py      (each of the 4 alert types)
    - alternate_route.py (cut-off / reroute reasoning)
    - field_reports.py   (conflict flag reasoning)

The build_*_reasoning() functions below are template-based string
generation only. No model calls, no inference. This mirrors the project's
core principle: if it's an explanation of a rule-based decision, it's a
template — not AI. Their output is the SINGLE source of truth used by:
    - Akshita's audit log
    - Bhoomika's tier-status display
Never generate separate text in each module — call these instead. This
part of the module's behavior is unchanged and is never allowed to depend
on an LLM being available.

Target format:
    "Dispatched via Route B — NH-150 closure probability 0.82,
     source: IMD forecast + Bhuvan susceptibility + 2 field reports,
     auto-dispatch tier (>85% confidence)."

explain_for_officer() at the bottom of this file is a SEPARATE, optional
addition: given a reasoning string that's already been built above, it asks
a local LLM (llm_backend.py, Ollama, fully offline once the model is
pulled) to rephrase it in plainer language for a human. It is opt-in, on-
demand only — never wired into automation.py's or field_reports.py's hot
paths — and always falls back to the original deterministic string
unchanged if the local model is unavailable or slow. It never touches the
audit-log string.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

import config
import llm_backend


# ---------------------------------------------------------------------------
# Tier label helpers
# ---------------------------------------------------------------------------

def _tier_label(action: str, confidence: float) -> str:
    """Human-readable tier label for inclusion in reasoning strings."""
    if action == "auto_dispatch":
        return f"auto-dispatch tier (>{config.AUTO_DISPATCH_THRESHOLD:.0%} confidence)"
    elif action == "act_with_override":
        return (
            f"act-with-override tier "
            f"({config.ACT_WITH_OVERRIDE_THRESHOLD:.0%}–{config.AUTO_DISPATCH_THRESHOLD:.0%} confidence, "
            f"{config.OVERRIDE_WINDOW_HOURS}h override window)"
        )
    elif action == "escalate":
        return f"escalate tier (<{config.ACT_WITH_OVERRIDE_THRESHOLD:.0%} confidence — human review required)"
    else:
        return f"unknown tier (action: {action})"


# ---------------------------------------------------------------------------
# Primary builder — automation.py and any module needing a full reasoning string
# ---------------------------------------------------------------------------

def build_reasoning(
    action: str,
    confidence: float,
    data_sources: List[str],
    route_info: Optional[dict] = None,
    extras: Optional[dict] = None,
) -> str:
    """
    Build the primary reasoning string for an automated tier decision.

    Args:
        action       : "auto_dispatch" | "act_with_override" | "escalate"
        confidence   : Confidence value from Shriti's model (0.0–1.0)
        data_sources : List of source labels, e.g. ["IMD forecast", "Bhuvan susceptibility", "2 field reports"]
        route_info   : Optional RouteResult or summary dict (for route-specific context)
        extras       : Optional dict of additional context (e.g. blocked_edges, eta_delta)

    Returns:
        Plain-English explanation string.

    Example output:
        "Dispatched via Route B — NH-150 closure probability 0.82,
         source: IMD forecast + Bhuvan susceptibility + 2 field reports,
         auto-dispatch tier (>85% confidence)."
    """
    extras = extras or {}
    source_str = _join_sources(data_sources)
    tier_str   = _tier_label(action, confidence)

    # Action verb
    if action == "auto_dispatch":
        verb = "Automated action taken"
    elif action == "act_with_override":
        verb = "Action taken with override window open"
    else:
        verb = "Escalated to human review — no automated action taken"

    # Route context
    route_str = ""
    if route_info:
        origin = route_info.get("origin", "origin")
        dest   = route_info.get("destination", "destination")
        time_m = route_info.get("total_time_minutes", "?")
        dist_k = route_info.get("total_distance_km", "?")
        route_str = f" Route: {origin} → {dest} ({dist_k} km, {time_m} min)."

    # Blocked edges context
    blocked = extras.get("blocked_edges", [])
    blocked_str = ""
    if blocked:
        blocked_str = f" Blocked: {', '.join(str(e) for e in blocked[:3])}" \
                      f"{'...' if len(blocked) > 3 else ''}."

    # ETA delta context
    eta_delta = extras.get("delay_delta_minutes")
    eta_str = ""
    if eta_delta is not None:
        eta_str = f" ETA change: +{eta_delta:.1f} min vs. normal route." if eta_delta >= 0 \
                  else f" ETA change: {eta_delta:.1f} min vs. normal route."

    return (
        f"{verb}.{route_str}{blocked_str}{eta_str} "
        f"Closure probability: {confidence:.2f}, source: {source_str}. "
        f"Tier: {tier_str}."
    ).strip()


# ---------------------------------------------------------------------------
# Alert reasoning builders (one per alert type)
# ---------------------------------------------------------------------------

def build_alert_reasoning(
    alert_type: str,
    location: str,
    trigger_value: float,
    threshold: float,
    data_sources: List[str],
    extras: Optional[dict] = None,
) -> str:
    """
    Build the reasoning string for one of the 4 alert types.

    Args:
        alert_type    : "blocked_road" | "inaccessible_region" |
                        "delayed_delivery" | "high_risk_corridor"
        location      : Edge osmid or node/village name
        trigger_value : The value that crossed the threshold (probability, delay minutes, etc.)
        threshold     : The configured threshold that was exceeded
        data_sources  : Source labels
        extras        : Additional context dict
    """
    extras = extras or {}
    source_str = _join_sources(data_sources)

    if alert_type == "blocked_road":
        return (
            f"BLOCKED ROAD ALERT: Segment '{location}' has closure probability "
            f"{trigger_value:.2f} (threshold: {threshold:.2f}). "
            f"Source: {source_str}. "
            f"Rerouting initiated."
        )

    elif alert_type == "inaccessible_region":
        blocked = extras.get("blocked_edges", [])
        blocked_str = f" via blocked segment(s): {', '.join(str(e) for e in blocked[:3])}" \
                      f"{'...' if len(blocked) > 3 else ''}" if blocked else ""
        return (
            f"INACCESSIBLE REGION ALERT: Node/village '{location}' is CUT OFF — "
            f"no viable route available{blocked_str}. "
            f"All paths pass through segment(s) with closure probability "
            f"≥ {threshold:.2f}. "
            f"Source: {source_str}. "
            f"Human intervention required."
        )

    elif alert_type == "delayed_delivery":
        baseline = extras.get("baseline_minutes", "?")
        adjusted = extras.get("adjusted_minutes", "?")
        factors  = extras.get("delay_factors", [])
        factor_str = f" Factors: {', '.join(factors)}." if factors else ""
        return (
            f"DELAYED DELIVERY ALERT: Route via '{location}' — "
            f"adjusted ETA {adjusted} min vs. baseline {baseline} min "
            f"(delta: +{trigger_value:.1f} min, threshold: +{threshold:.0f} min).{factor_str} "
            f"Source: {source_str}."
        )

    elif alert_type == "high_risk_corridor":
        return (
            f"HIGH-RISK CORRIDOR ALERT: Route through '{location}' has aggregate "
            f"closure risk {trigger_value:.2f} (threshold: {threshold:.2f}). "
            f"No single segment is fully blocked yet, but the corridor is high-risk. "
            f"Source: {source_str}. "
            f"Proactive rerouting recommended."
        )

    else:
        return (
            f"ALERT ({alert_type}): Trigger {trigger_value:.2f} exceeded threshold "
            f"{threshold:.2f} at '{location}'. Source: {source_str}."
        )


# ---------------------------------------------------------------------------
# Escalation reasoning (confidence < ACT_WITH_OVERRIDE_THRESHOLD)
# ---------------------------------------------------------------------------

def build_escalation_reasoning(
    confidence: float,
    route_info: Optional[dict],
    blocked_edges: List[str],
    data_sources: List[str],
) -> str:
    """
    Build the reasoning string for an escalation (tier 3 — no automated action).
    Includes the full reasoning chain as required by spec.
    """
    source_str   = _join_sources(data_sources)
    blocked_str  = (f"Blocked segments: {', '.join(blocked_edges[:5])}"
                    f"{'...' if len(blocked_edges) > 5 else ''}. ") if blocked_edges else ""

    route_str = ""
    if route_info:
        origin = route_info.get("origin", "?")
        dest   = route_info.get("destination", "?")
        route_str = f"Affected route: {origin} → {dest}. "

    return (
        f"ESCALATED TO HUMAN REVIEW. "
        f"Confidence {confidence:.2f} is below the act-with-override threshold "
        f"({config.ACT_WITH_OVERRIDE_THRESHOLD:.2f}). "
        f"No automated action has been taken. "
        f"{route_str}{blocked_str}"
        f"Source: {source_str}. "
        f"Full reasoning chain attached. Awaiting officer decision."
    )


# ---------------------------------------------------------------------------
# Cut-off / no-route reasoning
# ---------------------------------------------------------------------------

def build_no_route_reasoning(
    origin: str,
    destination: str,
    blocked_edges: List[str],
    data_sources: List[str],
) -> str:
    """
    Build the reasoning string for a 'no_route_available' result.
    Used by alternate_route.py and alerts.py (inaccessible_region alert).
    """
    source_str  = _join_sources(data_sources)
    blocked_str = (f"{', '.join(blocked_edges[:5])}"
                   f"{'...' if len(blocked_edges) > 5 else ''}") if blocked_edges else "none identified"

    return (
        f"CUT-OFF DETECTED: No viable route from '{origin}' to '{destination}'. "
        f"All available paths cross segment(s) with closure probability "
        f"≥ {config.CLOSURE_THRESHOLD:.2f} (blocked: {blocked_str}). "
        f"Source: {source_str}. "
        f"This location is currently inaccessible. Immediate escalation required."
    )


# ---------------------------------------------------------------------------
# Field report reasoning
# ---------------------------------------------------------------------------

def build_field_report_reasoning(
    edge_id: str,
    report_status: str,
    officer_id: str,
    adjusted_probability: float,
    data_sources: List[str],
    is_conflict: bool = False,
    conflict_detail: Optional[str] = None,
    hazard_type: Optional[str] = None,
    severity: Optional[str] = None,
) -> str:
    """
    Build the reasoning string for a field report ingestion event.
    Used by field_reports.py.

    hazard_type/severity are the (optional) output of field_report_nlp.py's
    offline classification of the officer's free-text notes. When present
    and informative, they're appended so the audit trail shows WHY a
    "blocked" report got the boost it did, not just that it was "blocked".
    """
    source_str = _join_sources(data_sources)
    base = (
        f"Field report received: segment '{edge_id}' reported as '{report_status}' "
        f"by officer '{officer_id}'. "
        f"Adjusted closure probability: {adjusted_probability:.2f}. "
        f"Source: {source_str}."
    )
    if hazard_type and hazard_type not in ("none", "unknown"):
        base += f" Notes classified as: {hazard_type}, severity {severity} (offline NLP)."
    if is_conflict:
        base += (
            f" CONFLICT DETECTED: {conflict_detail or 'Conflicting reports from different officers within the conflict window'}. "
            f"Confidence reduced by {config.FIELD_REPORT_CONFLICT_CONFIDENCE_PENALTY:.2f}. "
            f"Segment flagged for human review — no automated resolution."
        )
    return base


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _join_sources(sources: List[str]) -> str:
    """Join a list of source labels with ' + ' separator."""
    if not sources:
        return "unknown source"
    return " + ".join(str(s) for s in sources)


# ---------------------------------------------------------------------------
# Optional LLM-enriched briefing (see module docstring for the guarantees)
# ---------------------------------------------------------------------------

def explain_for_officer(reasoning_text: str) -> dict:
    """
    Given a reasoning string already produced by one of the build_*_reasoning()
    functions above, return both that original string and an OPTIONAL
    plain-language rephrase from a local LLM.

    Call this on-demand for a single decision a human is looking at (e.g. a
    "explain this in plain language" UI action) — NOT in a loop over many
    decisions. A local CPU-only model can take several seconds per call
    (see config.LLM_TIMEOUT_SECONDS), so this must never sit on the
    automation.py / field_reports.py hot path.

    Returns:
        {
          "audit_text": reasoning_text,   # unchanged — store THIS in the audit log
          "briefing":   str | None,       # LLM rephrase, or None if unavailable
          "llm_used":   bool,             # whether the briefing came from the LLM
        }

    If the local Ollama server isn't running (offline deployment, no model
    pulled yet, or it simply timed out), "briefing" is None and "llm_used"
    is False — callers should display audit_text in that case. It is
    already human-readable; the briefing is a nicety, not a requirement.
    """
    briefing = llm_backend.generate_briefing(reasoning_text)
    return {
        "audit_text": reasoning_text,
        "briefing": briefing,
        "llm_used": briefing is not None,
    }
