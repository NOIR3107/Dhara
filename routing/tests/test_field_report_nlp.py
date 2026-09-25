"""
tests/test_field_report_nlp.py — Module 9b: Offline field-report NLP
CRITICAL tests:
    1. Empty/very short notes never produce a confident classification.
    2. A missing model file degrades to "unknown", not a crash.
    3. Severity is never reported without an identified hazard.
    4. Trained model recognizes the clear hazard categories it was trained on.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import field_report_nlp as nlp


class TestEmptyOrShortNotes:
    def test_none_returns_none_hazard(self):
        result = nlp.classify_note(None)
        assert result["hazard_type"] == "none"
        assert result["severity"] == "none"
        assert result["hazard_confidence"] == 0.0

    def test_empty_string_returns_none(self):
        result = nlp.classify_note("")
        assert result["hazard_type"] == "none"

    def test_very_short_note_returns_none(self):
        result = nlp.classify_note("ok")
        assert result["hazard_type"] == "none"
        assert result["severity"] == "none"


class TestSeverityRequiresHazard:
    def test_no_hazard_notes_get_none_severity(self):
        result = nlp.classify_note("Road clear, no issues, dry surface, normal traffic")
        assert result["hazard_type"] == "none"
        assert result["severity"] == "none"


class TestTrainedClassifications:
    """These assume train_and_save() has produced models/field_report_classifier.pkl."""

    def test_impassable_landslide(self):
        result = nlp.classify_note(
            "Landslide near km 12, road fully buried under debris, no vehicle can pass"
        )
        assert result["hazard_type"] == "landslide"
        assert result["severity"] == "impassable"

    def test_impassable_washout(self):
        result = nlp.classify_note("Bridge deck washed away in flash flood, route completely severed")
        assert result["hazard_type"] == "washout"
        assert result["severity"] == "impassable"

    def test_minor_tree_fall(self):
        result = nlp.classify_note("Small branches down after wind, cleared easily by passing vehicles")
        assert result["hazard_type"] == "tree_fall"
        assert result["severity"] == "minor"

    def test_confidences_are_valid_probabilities(self):
        result = nlp.classify_note("Large tree fallen across full width of road, axe teams dispatched")
        assert 0.0 <= result["hazard_confidence"] <= 1.0
        assert 0.0 <= result["severity_confidence"] <= 1.0


class TestMissingModelFile:
    def test_missing_model_degrades_to_unknown(self, monkeypatch, tmp_path):
        monkeypatch.setattr(nlp, "MODEL_PATH", tmp_path / "does_not_exist.pkl")
        monkeypatch.setattr(nlp, "_bundle", None)
        result = nlp.classify_note("Landslide near km 12, road fully buried under debris")
        assert result["hazard_type"] == "unknown"
        assert result["severity"] == "unknown"
