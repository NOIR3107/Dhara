"""
tests/test_llm_backend.py — Module 6b: Offline-safe local LLM briefing layer
CRITICAL tests:
    1. Disabling REASONING_LLM_ENABLED always returns None (offline-first
       default must be a hard switch, not just "best effort").
    2. An unreachable host degrades to None, never raises.
    3. explain_for_officer() always returns the original text as audit_text,
       unchanged, regardless of whether the LLM was available.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import config
import llm_backend
import reasoning as rsn


class TestDisabled:
    def test_disabled_returns_none(self, monkeypatch):
        monkeypatch.setattr(config, "REASONING_LLM_ENABLED", False)
        assert llm_backend.generate_briefing("Some reasoning text.") is None

    def test_disabled_is_available_false(self, monkeypatch):
        monkeypatch.setattr(config, "REASONING_LLM_ENABLED", False)
        assert llm_backend.is_available() is False

    def test_disabled_warm_up_false(self, monkeypatch):
        monkeypatch.setattr(config, "REASONING_LLM_ENABLED", False)
        assert llm_backend.warm_up() is False


class TestUnreachableHost:
    def test_unreachable_host_returns_none_not_raises(self, monkeypatch):
        # Port 1 is reserved/unused — connection should fail fast.
        monkeypatch.setattr(config, "OLLAMA_HOST", "http://localhost:1")
        monkeypatch.setattr(config, "LLM_TIMEOUT_SECONDS", 2)
        result = llm_backend.generate_briefing("Some reasoning text.")
        assert result is None

    def test_unreachable_host_is_available_false(self, monkeypatch):
        monkeypatch.setattr(config, "OLLAMA_HOST", "http://localhost:1")
        assert llm_backend.is_available() is False

    def test_unreachable_host_warm_up_false(self, monkeypatch):
        monkeypatch.setattr(config, "OLLAMA_HOST", "http://localhost:1")
        assert llm_backend.warm_up(timeout_seconds=2) is False


class TestExplainForOfficerFallback:
    def test_audit_text_always_matches_input(self, monkeypatch):
        monkeypatch.setattr(config, "REASONING_LLM_ENABLED", False)
        original = "Automated action taken. Closure probability: 0.90."
        result = rsn.explain_for_officer(original)
        assert result["audit_text"] == original
        assert result["briefing"] is None
        assert result["llm_used"] is False

    def test_no_empty_string_edge_case_raises(self, monkeypatch):
        monkeypatch.setattr(config, "REASONING_LLM_ENABLED", False)
        result = rsn.explain_for_officer("")
        assert result["audit_text"] == ""
        assert result["briefing"] is None
