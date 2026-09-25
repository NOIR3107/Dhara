# Nirantar-NER — Prediction & Decision Engine (Shriti's build)

## Quick start
```
pip install pandas scikit-learn geopandas networkx xgboost joblib
python3 run_pipeline.py
```
Runs all stages in order and writes outputs to `outputs/`.

## Files (matches the assigned filenames)
| File | Does |
|---|---|
| `synthetic_data.py` | Generates a stand-in NER dataset (villages, road segments, weather, closures, depots). **Swap this for Akshita's real DB loaders** — every downstream file only depends on the column schemas this produces. |
| `features.py` | Builds the 9-feature road-segment table + label. |
| `closure_prediction.py` | Trains Logistic Regression baseline, then XGBoost. Time-based split (train 2023–24, test 2025). Tunes threshold for recall, reports precision+recall+ROC-AUC. Outputs closure probability 0–1. |
| `confidence.py` | Per-district confidence score from data volume + recency + segment coverage. |
| `vri.py` | Village Reachability Index — route-graph reachability × confidence penalty. Formula documented for Neel's sign-off. |
| `countdown.py` | Converts 7-day VRI trajectory into `hours_until_cutoff`. |
| `egress.py` | Travel time to nearest health facility, now vs. after predicted closure. |
| `prepositioning.py` | Dispatch plan: commodity, quantity, depot, destination, latest departure time. |
| `hazard_adjustment.py` | Post-model adjustment from live hazards (`hazard_events`: USGS quakes, GDACS cyclone wind buffers, FIRMS fires). Documented odds multipliers, capped at ×5, with every change and its reason written to `segment_hazard_flags`. Heuristic rules, not learned: the training data has no hazard columns. |
| `backtest.py` | Replays one real closure onset from the held-out test year and reports how many days early it would have been flagged. |
| `run_pipeline.py` | Runs all of the above in order. |

## For Neel
`VRI_and_OptionB_for_Neel.docx` — VRI formula + inputs table + why-no-separate-weights, and the Option B (predict-then-decide) rationale, plus open items and known limitations for Q&A.

## Known placeholders to replace with real numbers
- `PER_CAPITA_DAILY_NEED_UNITS` in `prepositioning.py` — align with the denial-days unit table.
- `CUTOFF_THRESHOLD = 30` in `countdown.py` — confirm with Neel.
- Closure-duration estimate is a heuristic severity band, not a learned model — flagged as a limitation, not hidden.
