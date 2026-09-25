"""
llm_backend.py — optional local LLM layer for human-facing briefings
========================================================================
Calls a LOCAL Ollama server to rephrase an already-computed, deterministic
reasoning string into a short, plain-language briefing for a field officer.

Design guarantees (read before changing anything here):
  - NEVER used for the underlying decision. automation.py's tier thresholds
    and every build_*_reasoning() template in reasoning.py are computed
    first, in full, with no LLM involved — this module only rewrites text
    that has already been decided and already has a deterministic form.
  - NEVER replaces the audit-log string. reasoning.py's build_*_reasoning()
    output remains the single, reproducible source of truth consumed by
    Akshita's audit log (see reasoning.py's module docstring). This module
    produces a SEPARATE "briefing" string for human display only — callers
    must keep storing the deterministic string in the audit trail.
  - Offline-safe by construction. No internet access is required at
    runtime — only once, to `ollama pull` the model. If the local server
    isn't running (a disconnected depot terminal, a field officer's laptop
    with no Ollama installed), every call fails fast and returns None.
    Callers MUST treat None as "no briefing available" and display the
    deterministic reasoning string as-is — it is already human-readable.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Optional

import config

_BRIEFING_INSTRUCTIONS = (
    "Rewrite the following automated system log line as a short, plain-"
    "language briefing (at most 2 sentences) for a field relief officer. "
    "Keep every number, place name, and status word EXACTLY as given. "
    "Do not invent any new facts, numbers, or locations. Do not add "
    "commentary or recommendations beyond what the log line already says.\n\n"
    "Log line: {reasoning_text}\n\nBriefing:"
)


def generate_briefing(reasoning_text: str) -> Optional[str]:
    """
    Ask the local model to rephrase `reasoning_text` in plain language.

    Returns None if LLM reasoning is disabled, the server is unreachable,
    the request times out, or the response is empty/malformed — for any
    of those, the caller should fall back to `reasoning_text` unchanged.
    """
    if not config.REASONING_LLM_ENABLED or not reasoning_text:
        return None

    body = json.dumps({
        "model": config.OLLAMA_MODEL,
        "prompt": _BRIEFING_INSTRUCTIONS.format(reasoning_text=reasoning_text),
        "stream": False,
        "keep_alive": config.OLLAMA_KEEP_ALIVE,
        "options": {"temperature": 0.2, "num_predict": 120},
    }).encode("utf-8")

    request = urllib.request.Request(
        f"{config.OLLAMA_HOST}/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=config.LLM_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return None

    text = str(payload.get("response", "")).strip()
    return text or None


def warm_up(timeout_seconds: float = 120) -> bool:
    """
    Load the model into memory ahead of the first real request (an empty
    prompt makes Ollama load the model without generating anything). A cold
    load takes ~20s on CPU-only hardware, longer than LLM_TIMEOUT_SECONDS, so
    without this the first briefing after startup would always fall back.
    Returns True if the model is loaded; never raises.
    """
    if not config.REASONING_LLM_ENABLED:
        return False
    body = json.dumps({
        "model": config.OLLAMA_MODEL,
        "prompt": "",
        "stream": False,
        "keep_alive": config.OLLAMA_KEEP_ALIVE,
    }).encode("utf-8")
    request = urllib.request.Request(
        f"{config.OLLAMA_HOST}/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds):
            return True
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return False


def is_available() -> bool:
    """
    Quick reachability check for the local Ollama server — used by callers
    or a status endpoint to show whether LLM briefings are currently on.
    Does not raise; a network error simply means "not available".
    """
    if not config.REASONING_LLM_ENABLED:
        return False
    try:
        with urllib.request.urlopen(f"{config.OLLAMA_HOST}/api/tags", timeout=4):
            return True
    except (urllib.error.URLError, TimeoutError, OSError):
        return False
