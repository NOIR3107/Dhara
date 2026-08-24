"""
Real Decision Agent Pipeline Runner for DHARA PostGIS Database
Target DB: postgresql://ner:ner_dev_password@localhost:5433/dhara

Runs the DHARA Autonomous Decision Agent across habitations and updates:
- dispatch_decisions
- audit_logs

Tiers:
- confidence > 0.85: AUTONOMOUS (auto_dispatch)
- 0.60 <= confidence <= 0.85: NOTIFIED / 2-HOUR OFFICER OVERRIDE (act_with_override)
- confidence < 0.60: ESCALATED (escalate)
"""
import sys
import os
import pandas as pd
import numpy as np
import psycopg2
import psycopg2.extras

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "model"))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "routing"))

import automation

DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "dhara",
    "user": "ner",
    "password": "ner_dev_password"
}

def run_decision_agent():
    print("=== EXECUTING DHARA AUTONOMOUS DECISION AGENT ===", flush=True)

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # Query top priority habitations with VRI scores, countdown, and egress metrics
    cur.execute("""
        SELECT h.id, h.name, h.district_id, v.vri, v.reachability_prob, v.confidence,
               COALESCE(c.hours_until_cutoff, 48.0) AS hours_until_cutoff,
               COALESCE(e.delta_min, 120.0) AS delta_min
        FROM habitations h
        JOIN vri_forecasts v ON h.id = v.village_id
        LEFT JOIN countdown_status c ON h.id = c.village_id
        LEFT JOIN egress_metrics e ON h.id = e.village_id
        WHERE v.forecast_date = (SELECT MIN(forecast_date) FROM vri_forecasts)
        ORDER BY v.vri ASC
        LIMIT 25;
    """)
    rows = cur.fetchall()

    # Query available depots
    cur.execute("SELECT id, name FROM depots;")
    depots = cur.fetchall()
    depot_id = depots[0][0] if depots else "depot_tezpur"
    depot_name = depots[0][1] if depots else "Tezpur Central Relief Depot"

    dispatches = []
    audit_records = []

    for r in rows:
        hab_id, hab_name, district, vri_score, reach_prob, conf, cutoff_hours, delta_min = r
        p_close = round(1.0 - float(reach_prob), 2)
        confidence_val = float(conf) if conf is not None else 0.87

        # Assign confidence tiers:
        # > 0.85 -> AUTONOMOUS
        # 0.60-0.85 -> NOTIFIED / 2-HOUR OFFICER OVERRIDE
        # < 0.60 -> ESCALATED
        if confidence_val > 0.85:
            tier_label = "AUTONOMOUS"
            action_type = "auto_dispatch"
        elif confidence_val >= 0.60:
            tier_label = "NOTIFIED / 2-HOUR OFFICER OVERRIDE"
            action_type = "act_with_override"
        else:
            tier_label = "ESCALATED"
            action_type = "escalate"

        cargo = "12t Ration Packs" if p_close > 0.3 else "5t Emergency Medical Kits"
        qty = 12 if p_close > 0.3 else 5
        egress_hours = round(float(delta_min) / 60.0, 1)

        reasoning_str = (
            f"Pre-positioned {qty}t {cargo.lower()} to {hab_name} ({hab_id}). "
            f"Reason: predicted road closure probability {p_close:.2f} within {cutoff_hours:.0f} hours; "
            f"VRI projected at {vri_score:.1f}; alternate route adds {egress_hours:.1f} hours. "
            f"Confidence {confidence_val:.2f}. Tier: {tier_label.lower()}."
        )

        dispatches.append((
            hab_id,
            depot_id,
            qty,
            qty,
            tier_label,
            reasoning_str,
            'DERIVED'
        ))

        audit_records.append((
            f"DISPATCH_{hab_id}",
            confidence_val,
            reasoning_str,
            'DERIVED'
        ))

    # Clear and re-populate dispatch_decisions and audit_logs
    cur.execute("TRUNCATE TABLE dispatch_decisions RESTART IDENTITY;")
    cur.execute("TRUNCATE TABLE audit_logs RESTART IDENTITY;")

    psycopg2.extras.execute_values(cur, """
        INSERT INTO dispatch_decisions (village_id, depot_id, units_required, units_shipped, tier, reasoning, data_provenance)
        VALUES %s;
    """, dispatches)

    psycopg2.extras.execute_values(cur, """
        INSERT INTO audit_logs (action, confidence, reasoning, data_provenance)
        VALUES %s;
    """, audit_records)

    conn.commit()

    # Verification queries
    cur.execute("SELECT COUNT(*) FROM dispatch_decisions;")
    dp_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM audit_logs;")
    al_count = cur.fetchone()[0]

    conn.close()

    print(f"Decision Agent Execution Completed:")
    print(f"  Dispatches Created : {dp_count}")
    print(f"  Audit Logs Created : {al_count}")
    print(f"  Sample Reasoning   : {dispatches[0][5]}")
    return dp_count, al_count

if __name__ == "__main__":
    run_decision_agent()
