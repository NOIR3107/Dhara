"""
automation.py — Module 7: Confidence-Tiered Automation
========================================================
Governance core of the system — the answer to "would a ministry actually let
this run." Implements exactly three tiers with fixed thresholds from config.py.

Tiers (thresholds are CONSTANTS, never buried inline):
    confidence > AUTO_DISPATCH_THRESHOLD (0.85)
        → auto_dispatch: issue reroute/dispatch without waiting for human click.

    ACT_WITH_OVERRIDE_THRESHOLD (0.60) ≤ confidence ≤ AUTO_DISPATCH_THRESHOLD
        → act_with_override: take action, notify officer, open 2-hour override window.

    confidence < ACT_WITH_OVERRIDE_THRESHOLD
        → escalate: attach full reasoning chain, take NO automated action.

Every tier calls reasoning.py — automation.py NEVER acts silently.

Output structure (consumed directly by Bhoomika's display layer):
{
    "action":                   "auto_dispatch" | "act_with_override" | "escalate",
    "confidence":               float,
    "override_window_expires_at": "ISO datetime string" | null,
    "reasoning":                "string from reasoning.py"
}
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import config
import reasoning as rsn


# ---------------------------------------------------------------------------
# Type alias
# ---------------------------------------------------------------------------
AutomationResult = Dict


# ---------------------------------------------------------------------------
# Core decision function
# ---------------------------------------------------------------------------

def decide_action(
    confidence: float,
    data_sources: List[str],
    route_info: Optional[dict] = None,
    extras: Optional[dict] = None,
) -> AutomationResult:
    """
    Apply the three-tier confidence rule and return an AutomationResult.

    Args:
        confidence   : Confidence value from Shriti's model (0.0–1.0).
                       Consumed as-is — never recomputed here.
        data_sources : List of source labels for the reasoning string.
                       E.g. ["IMD forecast", "Bhuvan susceptibility", "2 field reports"]
        route_info   : Optional RouteResult dict for context in reasoning string.
        extras       : Optional dict — may include:
                         blocked_edges      : list of blocked edge osmids
                         delay_delta_minutes: ETA delta for reasoning context

    Returns:
        AutomationResult dict with action, confidence, override_window_expires_at, reasoning.

    DESIGN NOTE:
        The tier logic is a plain if/elif/else — no ambiguity, no fuzzy logic,
        no judgment calls. The thresholds in config.py are the single authoritative
        source of tier boundaries.
    """
    extras = extras or {}

    # -----------------------------------------------------------------------
    # Tier 1: AUTO-DISPATCH (confidence strictly above AUTO_DISPATCH_THRESHOLD)
    # -----------------------------------------------------------------------
    if confidence > config.AUTO_DISPATCH_THRESHOLD:
        action = "auto_dispatch"
        override_expires = None
        reason = rsn.build_reasoning(
            action=action,
            confidence=confidence,
            data_sources=data_sources,
            route_info=route_info,
            extras=extras,
        )

    # -----------------------------------------------------------------------
    # Tier 2: ACT WITH OVERRIDE (confidence in [ACT_WITH_OVERRIDE_THRESHOLD, AUTO_DISPATCH_THRESHOLD])
    # -----------------------------------------------------------------------
    elif confidence >= config.ACT_WITH_OVERRIDE_THRESHOLD:
        action = "act_with_override"
        override_expires = _compute_override_expiry()
        reason = rsn.build_reasoning(
            action=action,
            confidence=confidence,
            data_sources=data_sources,
            route_info=route_info,
            extras={**extras, "override_window_expires_at": override_expires},
        )

    # -----------------------------------------------------------------------
    # Tier 3: ESCALATE (confidence below ACT_WITH_OVERRIDE_THRESHOLD)
    # -----------------------------------------------------------------------
    else:
        action = "escalate"
        override_expires = None
        blocked_edges = extras.get("blocked_edges", [])
        reason = rsn.build_escalation_reasoning(
            confidence=confidence,
            route_info=route_info,
            blocked_edges=blocked_edges,
            data_sources=data_sources,
        )

    return {
        "action":                     action,
        "confidence":                 round(confidence, 4),
        "override_window_expires_at": override_expires,
        "reasoning":                  reason,
    }


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _compute_override_expiry() -> str:
    """
    Return an ISO 8601 datetime string for the override window expiry.
    Uses UTC time. The display layer (Bhoomika's) can convert to local time.
    """
    expiry = datetime.now(tz=timezone.utc) + timedelta(hours=config.OVERRIDE_WINDOW_HOURS)
    return expiry.isoformat()


# ---------------------------------------------------------------------------
# Boundary helpers (used by tests to verify tier boundaries precisely)
# ---------------------------------------------------------------------------

def get_tier(confidence: float) -> str:
    """
    Return the tier name for a given confidence value without producing a full result.
    Useful for assertions in tests.
    """
    if confidence > config.AUTO_DISPATCH_THRESHOLD:
        return "auto_dispatch"
    elif confidence >= config.ACT_WITH_OVERRIDE_THRESHOLD:
        return "act_with_override"
    else:
        return "escalate"
