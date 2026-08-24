"""
run_pipeline.py
-----------------
Runs the full Shriti prediction pipeline end to end, in dependency order.
Use this for the demo. Individual scripts can still be run standalone for
debugging/iteration (each has a __main__ block).

Order matches the dependency chain:
  synthetic_data -> features -> closure_prediction (train) -> confidence
  -> vri -> countdown -> egress -> prepositioning -> backtest
"""

import subprocess
import sys

STAGES = [
    "synthetic_data.py",   # swap for real Akshita-DB loaders when ready
    "features.py",
    "closure_prediction.py",
    "confidence.py",
    "vri.py",
    "countdown.py",
    "egress.py",
    "prepositioning.py",
    "backtest.py",
]

if __name__ == "__main__":
    for stage in STAGES:
        print(f"\n{'='*70}\nSTAGE: {stage}\n{'='*70}")
        result = subprocess.run([sys.executable, stage])
        if result.returncode != 0:
            print(f"\nPipeline stopped: {stage} failed.")
            sys.exit(1)
    print(f"\n{'='*70}\nPipeline complete. Outputs in outputs/, model in models/.\n{'='*70}")
