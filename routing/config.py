"""
config.py — Nirantar Routes & Automation Layer
===============================================
ALL named constants for the system live here.
No module may embed a threshold, multiplier, or district name directly —
always import from this file.

OPERATING_DISTRICTS is a placeholder. Replace with confirmed district names
before production. The seed script and OSMnx loader accept real names with
ZERO code changes — update this list only.
"""

# ---------------------------------------------------------------------------
# DISTRICT CONFIGURATION
# Placeholder — swappable without any code changes outside this file.
# Format: list of dicts with keys:
#   name        : human-readable district name (used for display + reasoning strings)
#   place_query : OSMnx-compatible query string (used when loading from OpenStreetMap)
#   district_id : short slug used as the 'district' attribute on graph edges
#   type        : "hill" | "valley" (used for district-type-specific logic)
# ---------------------------------------------------------------------------
OPERATING_DISTRICTS = [
    {
        "name": "HILL_DISTRICT_TBD",
        "place_query": "HILL_DISTRICT_TBD, India",   # Replace with e.g. "Tawang, Arunachal Pradesh, India"
        "district_id": "hill_tbd",
        "type": "hill",
    },
    {
        "name": "VALLEY_DISTRICT_TBD",
        "place_query": "VALLEY_DISTRICT_TBD, India",  # Replace with e.g. "Kamrup, Assam, India"
        "district_id": "valley_tbd",
        "type": "valley",
    },
]

# ---------------------------------------------------------------------------
# GRAPH / DATA SOURCE MODE
# "geojson" : load from local GeoJSON files (default; works offline; used in tests)
# "osmnx"   : pull live data from OpenStreetMap via OSMnx
# ---------------------------------------------------------------------------
GRAPH_DATA_SOURCE = "geojson"   # switch to "osmnx" when real district names are confirmed

# Default GeoJSON paths (relative to project root) — used when GRAPH_DATA_SOURCE = "geojson"
GEOJSON_PATHS = {
    "hill_tbd":   "data/districts/hill_district.geojson",
    "valley_tbd": "data/districts/valley_district.geojson",
}

# ---------------------------------------------------------------------------
# BASE SPEEDS (km/h) BY OSM highway CLASS
# Used by graph.py to compute travel_time_min per edge.
# Add more classes as needed — routing logic never references a class by name.
# ---------------------------------------------------------------------------
BASE_SPEED_KMPH = {
    "motorway":       80,
    "trunk":          60,
    "primary":        50,
    "secondary":      40,
    "tertiary":       30,
    "unclassified":   25,
    "residential":    20,
    "track":          15,
    "path":           10,
    "service":        20,
    "default":        25,   # fallback for unknown classes
}

# ---------------------------------------------------------------------------
# CLOSURE / REROUTING
# ---------------------------------------------------------------------------
# Edge closure probability threshold (0-1).
# Edges at or above this value are treated as BLOCKED for routing.
CLOSURE_THRESHOLD = 0.70

# ---------------------------------------------------------------------------
# AUTOMATION TIER THRESHOLDS
# confidence > AUTO_DISPATCH_THRESHOLD          → auto_dispatch (act immediately)
# ACT_WITH_OVERRIDE_THRESHOLD ≤ conf ≤ AUTO    → act_with_override (act + notify)
# confidence < ACT_WITH_OVERRIDE_THRESHOLD      → escalate (no action)
# ---------------------------------------------------------------------------
AUTO_DISPATCH_THRESHOLD      = 0.85
ACT_WITH_OVERRIDE_THRESHOLD  = 0.60

# Hours the responsible officer has to reverse an act_with_override action
OVERRIDE_WINDOW_HOURS = 2

# ---------------------------------------------------------------------------
# ETA DELAY FACTOR MULTIPLIERS
# Applied multiplicatively to edge travel_time_min.
# A multiplier of 1.0 means no delay. >1.0 adds delay.
# ---------------------------------------------------------------------------
# Rainfall / weather severity levels (0 = none, 1 = light, 2 = moderate, 3 = heavy)
ETA_RAIN_MULTIPLIER = {
    0: 1.00,
    1: 1.15,
    2: 1.40,
    3: 1.80,
}

# Poor road surface condition (applies when edge surface is 'unpaved', 'gravel', 'dirt', 'mud')
ETA_POOR_SURFACE_MULTIPLIER = 1.35

# Surfaces considered "poor" — data-driven, not tied to a specific road name
POOR_SURFACE_TYPES = {"unpaved", "gravel", "dirt", "mud", "ground", "grass"}

# Night-time travel restriction multiplier (applies between NIGHT_START_HOUR and NIGHT_END_HOUR)
# Some rural NER roads are effectively unsafe / restricted after dark.
ETA_NIGHT_MULTIPLIER = 1.50

# Hours (24h clock) defining the night-time window
NIGHT_START_HOUR = 20   # 8 PM
NIGHT_END_HOUR   = 6    # 6 AM

# Whether night restriction applies to all edges or only edges with is_night_restricted=True
# "all"          : apply to every edge in the network
# "flagged_only" : apply only to edges whose GeoJSON properties include is_night_restricted=true
NIGHT_RESTRICTION_SCOPE = "flagged_only"

# ---------------------------------------------------------------------------
# CONGESTION PROXY SCORES (additive, clamped to 1.0)
# These are structural bottleneck signals — NOT live traffic data.
# See congestion.py for full explanation.
# ---------------------------------------------------------------------------
CONGESTION_SINGLE_LANE_BRIDGE   = 0.30
CONGESTION_MARKET_DAY           = 0.20
CONGESTION_FESTIVAL_DAY         = 0.25
CONGESTION_CHOKEPOINT           = 0.20

# Path to the congestion calendar YAML (swappable — replace file, not code)
CONGESTION_CALENDAR_PATH = "data/congestion_calendar.yaml"

# ---------------------------------------------------------------------------
# ALERT THRESHOLDS
# ---------------------------------------------------------------------------
# Delay (in minutes vs. baseline) that triggers a "delayed_delivery" alert
DELAY_ALERT_THRESHOLD_MINUTES = 30

# Aggregate route risk (mean closure probability across all route edges)
# that triggers a "high_risk_corridor" alert, even if no single edge is blocked
HIGH_RISK_CORRIDOR_THRESHOLD = 0.45

# ---------------------------------------------------------------------------
# FIELD REPORTS
# ---------------------------------------------------------------------------
# Time window (minutes) within which two conflicting reports on the same edge
# trigger a conflict — lowering confidence and flagging for human review
FIELD_REPORT_CONFLICT_WINDOW_MINUTES = 60

# Probability added to base when a "blocked" field report is received (strong signal)
FIELD_REPORT_BLOCKED_BOOST = 0.20

# Probability subtracted from base when a "clear" field report is received
FIELD_REPORT_CLEAR_REDUCTION = 0.10

# Confidence penalty applied when conflicting reports are detected
FIELD_REPORT_CONFLICT_CONFIDENCE_PENALTY = 0.20

# Severity-aware boost for "blocked" reports, keyed by the hazard severity
# extracted from the officer's free-text notes by field_report_nlp.py.
# "none" (no notes, or notes too short to classify) intentionally maps to
# the same value as the old flat FIELD_REPORT_BLOCKED_BOOST so behavior for
# reports with no notes is unchanged. "unknown" covers a missing/untrained
# model file — same safe default.
FIELD_REPORT_SEVERITY_BOOST = {
    "impassable": 0.35,
    "major":      0.20,
    "minor":      0.08,
    "none":       FIELD_REPORT_BLOCKED_BOOST,
    "unknown":    FIELD_REPORT_BLOCKED_BOOST,
}

# ---------------------------------------------------------------------------
# LLM REASONING (optional, offline-first)
# ---------------------------------------------------------------------------
# reasoning.py's build_*_reasoning() functions remain deterministic templates
# ALWAYS — they are the audit-log source of truth and never call an LLM.
# When enabled, llm_backend.py additionally asks a LOCAL Ollama server to
# rephrase an already-computed reasoning string into a short plain-language
# briefing for a field officer. This is a separate, optional, human-facing
# string — never used for the audit log and never able to change a decision.
#
# Offline guarantee: no internet access is required at runtime (only once,
# to pull the model). If the local server isn't running — e.g. a
# disconnected depot terminal — every call fails fast and silently, and
# callers fall back to the deterministic reasoning string unchanged.
# reasoning.explain_for_officer() is deliberately NOT called from the
# automation.py / field_reports.py hot paths — decide_action() and
# ReportStore.ingest() must stay fast and fully deterministic. Measured on
# CPU-only hardware, even a warm llama3.2:1b call takes ~8-12s (there's no
# GPU to accelerate it here); a cold call (model not yet loaded) can take
# ~20s. That's fine for an on-demand "explain this one decision in plain
# language" call a human triggers, but far too slow to run on every
# automation decision or every field report in a pipeline sweep. Callers
# that DO invoke it should do so sparingly, by design.
# "127.0.0.1" rather than "localhost" deliberately — on machines where
# "localhost" resolves to the IPv6 loopback (::1) first (common on Windows),
# an Ollama server bound only to IPv4 makes that first connection attempt
# hang until it times out before falling back to IPv4, which can burn the
# entire LLM_TIMEOUT_SECONDS budget on name resolution alone. Skip the
# ambiguity entirely.
REASONING_LLM_ENABLED = True
OLLAMA_HOST = "http://127.0.0.1:11434"
OLLAMA_MODEL = "llama3.2:1b"
# The dashboard shows a template explanation instantly and only adds the LLM
# rewording underneath, so a longer wait here never blocks the officer.
LLM_TIMEOUT_SECONDS = 30

# How long Ollama keeps the model in memory after a request. Ollama's default
# (5 minutes) means the first briefing after a quiet spell pays a ~20s reload,
# which exceeds LLM_TIMEOUT_SECONDS. web/server.py also preloads the model at
# startup (llm_backend.warm_up) for the same reason.
OLLAMA_KEEP_ALIVE = "12h"

# ---------------------------------------------------------------------------
# UPDATE CYCLE
# Defines the cadence at which the system processes new data and re-evaluates.
# Field reports take effect IMMEDIATELY on ingest; the update cycle governs
# when the full pipeline (rerouting, ETA, alerts) is re-run.
# ---------------------------------------------------------------------------
UPDATE_CYCLE_MINUTES = 15
