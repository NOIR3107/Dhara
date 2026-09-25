"""
field_report_nlp.py — Module 9b: Field-report note classification
=====================================================================
Offline NLP classifier for the free-text `notes` field on a FieldReport.

field_reports.py already ingests "blocked" / "clear" reports and boosts or
reduces closure probability by a flat amount either way (see
config.FIELD_REPORT_BLOCKED_BOOST). That treats "small branch on the
shoulder" the same as "bridge washed out, no vehicle access" — both just
say "blocked". This module reads the officer's actual notes and extracts:

    hazard_type : landslide | washout | tree_fall | flooding | subsidence | none
    severity    : impassable | major | minor | none

so that field_reports.py can look up a severity-specific boost from
config.FIELD_REPORT_SEVERITY_BOOST instead of one flat number for every
"blocked" report.

Fully offline: TF-IDF + Logistic Regression (scikit-learn only). No network
call, no GPU, sub-5ms per note — safe to run on a field officer's device or
a disconnected depot terminal, unlike a cloud NLP API.

Training data below is a synthetic placeholder set (same spirit as
model/synthetic_data.py — see that file's own "swap this for real data"
note). Swap TRAINING_EXAMPLES for a real corpus of historical field-officer
notes once available; classify_note()'s interface does not change.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "field_report_classifier.pkl"

HAZARD_TYPES = ["landslide", "washout", "tree_fall", "flooding", "subsidence", "none"]
SEVERITIES = ["impassable", "major", "minor", "none"]

# (officer note text, hazard_type, severity)
TRAINING_EXAMPLES: List[Tuple[str, str, str]] = [
    # --- landslide ---
    ("Landslide near km 12, road fully buried under debris, no vehicle can pass", "landslide", "impassable"),
    ("Large boulder fall blocking both lanes past the ridge, JCB needed to clear", "landslide", "impassable"),
    ("Massive landslide has completely buried the road near the pass, no way through", "landslide", "impassable"),
    ("Hillside collapsed onto the carriageway overnight, road sealed off entirely", "landslide", "impassable"),
    ("Small mudslide on shoulder, one lane still open, traffic moving slowly", "landslide", "major"),
    ("Debris slide narrowed the road to a single lane, long queue building", "landslide", "major"),
    ("Loose debris from hillside on edge of road, passable with caution", "landslide", "minor"),
    ("Minor rockfall overnight, cleared by morning patrol", "landslide", "minor"),
    ("A few stones and mud on the shoulder after rain, cars driving around it fine", "landslide", "minor"),
    # --- washout ---
    ("Bridge deck washed away in flash flood, route completely severed", "washout", "impassable"),
    ("Culvert washed out, deep gap in carriageway, vehicles cannot cross", "washout", "impassable"),
    ("Entire approach road collapsed into the river, no crossing possible", "washout", "impassable"),
    ("Approach road to bridge eroded, only two-wheelers can cross carefully", "washout", "major"),
    ("Half the carriageway washed away near the stream, single-lane crossing only", "washout", "major"),
    ("Shoulder erosion from last night's rain, road narrowed but passable", "washout", "minor"),
    ("Old washout patch repaired temporarily, minor bump but drivable", "washout", "minor"),
    ("Small erosion at the edge of the road, four-wheelers passing without issue", "washout", "minor"),
    # --- tree_fall ---
    ("Large tree fallen across full width of road after storm, axe teams dispatched", "tree_fall", "impassable"),
    ("Fallen pine trunk blocks carriageway completely near forest checkpost", "tree_fall", "impassable"),
    ("Big tree down across both lanes, nobody can get through until it's cleared", "tree_fall", "impassable"),
    ("Tree branch blocking one lane, cars squeezing past", "tree_fall", "major"),
    ("Fallen tree partially blocking road, only small vehicles can pass around it", "tree_fall", "major"),
    ("Small branches down after wind, cleared easily by passing vehicles", "tree_fall", "minor"),
    ("A few twigs and leaves on the road after the storm, no real obstruction", "tree_fall", "minor"),
    # --- flooding ---
    ("Road submerged under two feet of water near the stream crossing, impassable for cars", "flooding", "impassable"),
    ("Complete waterlogging across the carriageway, no vehicle attempting to cross", "flooding", "impassable"),
    ("Waterlogging ankle deep after heavy rain, trucks crossing slowly", "flooding", "major"),
    ("Standing water covers most of the road near the market, cars going very slow", "flooding", "major"),
    ("Light waterlogging near market, expected to clear by evening", "flooding", "minor"),
    ("Flash flood water receded, road clear again but muddy", "flooding", "minor"),
    ("Puddles on the road after rain, no trouble for normal traffic", "flooding", "minor"),
    # --- subsidence ---
    ("Ground subsidence has swallowed half the carriageway, road impassable", "subsidence", "impassable"),
    ("Large sinkhole opened up overnight, road completely closed at that point", "subsidence", "impassable"),
    ("Wide crack opened across the road surface, subsidence risk, avoid heavy vehicles", "subsidence", "major"),
    ("Road sinking near culvert, one lane closed for safety", "subsidence", "major"),
    ("Hairline cracks noticed on shoulder, monitoring, still passable", "subsidence", "minor"),
    ("Small dip forming in the road surface, cars driving over it without trouble", "subsidence", "minor"),
    # --- none / all clear ---
    ("Road clear, no issues, dry surface, normal traffic", "none", "none"),
    ("Checked segment, everything normal, no obstruction", "none", "none"),
    ("All clear after yesterday's rain, road fully open", "none", "none"),
    ("No hazards observed, visibility good, road in fine condition", "none", "none"),
    ("Patrolled the full stretch, nothing to report, traffic flowing normally", "none", "none"),
    ("Surface dry, no debris, no water, road in good condition today", "none", "none"),
]


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def train_and_save(path: Path = MODEL_PATH) -> Dict[str, float]:
    """Train the hazard_type and severity classifiers and persist them via joblib."""
    texts = [_clean(t) for t, _, _ in TRAINING_EXAMPLES]
    hazards = [h for _, h, _ in TRAINING_EXAMPLES]
    severities = [s for _, _, s in TRAINING_EXAMPLES]

    hazard_pipe = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
        ("clf", LogisticRegression(max_iter=1000)),
    ])
    severity_pipe = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
        ("clf", LogisticRegression(max_iter=1000)),
    ])
    hazard_pipe.fit(texts, hazards)
    severity_pipe.fit(texts, severities)

    stats = {
        "train_accuracy_hazard": hazard_pipe.score(texts, hazards),
        "train_accuracy_severity": severity_pipe.score(texts, severities),
        "n_examples": len(texts),
    }

    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"hazard_pipe": hazard_pipe, "severity_pipe": severity_pipe}, path)
    return stats


_bundle = None  # lazy-loaded, module-level cache


def _load_bundle():
    global _bundle
    if _bundle is None:
        _bundle = joblib.load(MODEL_PATH)
    return _bundle


def classify_note(text: Optional[str]) -> Dict[str, object]:
    """
    Classify a field officer's free-text note into (hazard_type, severity).

    Empty or very short text (e.g. None, "", "ok") returns low-confidence
    "none" rather than guessing — a one-word note should not drive a
    severity-specific probability boost. A missing/untrained model file
    returns "unknown" rather than raising, so field_reports.py can always
    fall back to config.FIELD_REPORT_SEVERITY_BOOST["unknown"].
    """
    if not text or len(text.strip()) < 4:
        return {"hazard_type": "none", "severity": "none", "hazard_confidence": 0.0, "severity_confidence": 0.0}

    try:
        bundle = _load_bundle()
    except FileNotFoundError:
        return {"hazard_type": "unknown", "severity": "unknown", "hazard_confidence": 0.0, "severity_confidence": 0.0}

    cleaned = _clean(text)
    hazard_pipe = bundle["hazard_pipe"]
    severity_pipe = bundle["severity_pipe"]

    hazard_proba = hazard_pipe.predict_proba([cleaned])[0]
    severity_proba = severity_pipe.predict_proba([cleaned])[0]
    hazard_idx = hazard_proba.argmax()
    severity_idx = severity_proba.argmax()

    hazard_type = str(hazard_pipe.classes_[hazard_idx])
    severity = str(severity_pipe.classes_[severity_idx])
    severity_confidence = float(severity_proba[severity_idx])

    # Severity is meaningless without an identified hazard — don't let the
    # severity model's independent guess contradict "no hazard found".
    if hazard_type == "none":
        severity = "none"
        severity_confidence = float(severity_proba[severity_pipe.classes_.tolist().index("none")])

    return {
        "hazard_type": hazard_type,
        "severity": severity,
        "hazard_confidence": round(float(hazard_proba[hazard_idx]), 3),
        "severity_confidence": round(severity_confidence, 3),
    }


if __name__ == "__main__":
    stats = train_and_save()
    print(f"Trained on {stats['n_examples']} synthetic examples.")
    print(
        f"Train accuracy — hazard_type: {stats['train_accuracy_hazard']:.3f}, "
        f"severity: {stats['train_accuracy_severity']:.3f}"
    )
    print(f"Saved to {MODEL_PATH}")

    print("\nSample predictions:")
    samples = [
        "Massive landslide has completely buried the road near the pass, no way through",
        "Little bit of mud on the road after rain but cars going fine",
        "Bridge collapsed, water flowing over what's left of the deck",
        "All good here, dry and clear",
        "ok",
    ]
    for s in samples:
        print(f"  {s!r} -> {classify_note(s)}")
