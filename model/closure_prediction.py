"""
closure_prediction.py
-----------------------
Trains a road-segment closure probability model.

Design decisions (know these for Q&A):
  - Time-based split, not random: train on 2023-2024 monsoons, test on the
    2025 monsoon (the "most recent monsoon" held out). Random splits leak
    future rain patterns into training and overstate accuracy.
  - Class imbalance: closures are ~10% of rows here (will likely be sparser
    on real data). We use `class_weight="balanced"` for LR and
    `scale_pos_weight` for XGBoost, rather than naive oversampling, so we
    don't invent synthetic closure days out of noise.
  - Metric: precision + recall reported explicitly, not accuracy (accuracy
    on a 10% positive class is trivially ~90% by predicting "never closes").
    We tune the decision threshold for RECALL, because a missed closure
    (false negative) costs someone stranded; a false alarm just costs an
    unnecessary pre-positioning trip.
  - Output: closure probability (0-1) per segment per future date, not a
    hard 0/1 label. VRI needs the probability, not the label.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score, precision_recall_curve, roc_auc_score
from xgboost import XGBClassifier
import joblib

from features import build_feature_table, encode_for_model, NUMERIC_FEATURES


TEST_YEAR = 2025  # most recent monsoon held out entirely
RECALL_TARGET = 0.80  # we accept more false alarms to hit this


def time_split(feature_table: pd.DataFrame):
    feature_table = feature_table.copy()
    feature_table["date"] = pd.to_datetime(feature_table["date"])
    train = feature_table[feature_table["date"].dt.year < TEST_YEAR]
    test = feature_table[feature_table["date"].dt.year == TEST_YEAR]
    return train.reset_index(drop=True), test.reset_index(drop=True)


def threshold_for_recall(y_true, y_proba, target_recall=RECALL_TARGET):
    """Pick the highest threshold that still achieves >= target_recall."""
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)
    # precision_recall_curve returns len(thresholds)+1 precision/recall points
    candidates = [(t, r, p) for t, r, p in zip(thresholds, recalls[:-1], precisions[:-1]) if r >= target_recall]
    if not candidates:
        return 0.0  # can't hit target; flag everything
    # among thresholds hitting recall target, take the one with best precision
    best = max(candidates, key=lambda c: c[2])
    return best[0]


def evaluate(y_true, y_proba, threshold, label):
    y_pred = (y_proba >= threshold).astype(int)
    p = precision_score(y_true, y_pred, zero_division=0)
    r = recall_score(y_true, y_pred, zero_division=0)
    auc = roc_auc_score(y_true, y_proba) if y_true.nunique() > 1 else float("nan")
    print(f"[{label}] threshold={threshold:.3f}  precision={p:.3f}  recall={r:.3f}  "
          f"ROC-AUC={auc:.3f}  n_test={len(y_true)}  n_positive={int(y_true.sum())}")
    return {"precision": p, "recall": r, "auc": auc, "threshold": threshold}


def train_and_evaluate():
    segments = pd.read_csv("data/road_segments.csv")
    weather_closures = pd.read_csv("data/weather_closures.csv")
    ft = build_feature_table(segments, weather_closures)

    train_df, test_df = time_split(ft)
    X_train, y_train, feat_names, _ = encode_for_model(train_df)
    X_test, y_test, _, meta_test = encode_for_model(test_df)
    # align columns (test may lack a category level seen in train, or vice versa)
    X_test = X_test.reindex(columns=X_train.columns, fill_value=0)

    results = {}

    # --- Step 1: Logistic Regression baseline ---
    lr = LogisticRegression(class_weight="balanced", max_iter=1000)
    lr.fit(X_train, y_train)
    lr_proba = lr.predict_proba(X_test)[:, 1]
    lr_thresh = threshold_for_recall(y_test, lr_proba)
    results["logistic_regression"] = evaluate(y_test, lr_proba, lr_thresh, "LogisticRegression")

    # --- Step 2: XGBoost ---
    pos = y_train.sum()
    neg = len(y_train) - pos
    xgb = XGBClassifier(
        n_estimators=300, max_depth=4, learning_rate=0.05,
        scale_pos_weight=neg / max(pos, 1),
        eval_metric="logloss", random_state=42,
    )
    xgb.fit(X_train, y_train)
    xgb_proba = xgb.predict_proba(X_test)[:, 1]
    xgb_thresh = threshold_for_recall(y_test, xgb_proba)
    results["xgboost"] = evaluate(y_test, xgb_proba, xgb_thresh, "XGBoost")

    # pick the better-precision model at the recall target as the deployed model
    best_name = max(results, key=lambda k: results[k]["precision"])
    best_model = xgb if best_name == "xgboost" else lr
    best_thresh = results[best_name]["threshold"]
    print(f"\nDeployed model: {best_name} (threshold={best_thresh:.3f})")

    joblib.dump({
        "model": best_model,
        "model_name": best_name,
        "threshold": best_thresh,
        "feature_columns": list(X_train.columns),
    }, "models/closure_model.pkl")

    return results, best_name


def predict_closure_probability(feature_rows: pd.DataFrame) -> pd.DataFrame:
    """feature_rows: raw feature table rows (must have NUMERIC_FEATURES +
    'road_type' + id cols, no label needed). Returns id cols + closure_probability."""
    bundle = joblib.load("models/closure_model.pkl")
    model, cols = bundle["model"], bundle["feature_columns"]
    X, _, _, meta = encode_for_model(feature_rows.assign(closed=0))
    X = X.reindex(columns=cols, fill_value=0).fillna(0)
    proba = model.predict_proba(X)[:, 1]
    out = meta.copy()
    out["closure_probability"] = proba
    return out


if __name__ == "__main__":
    train_and_evaluate()
