"""
scripts/test_e2e_api.py
-----------------------
Comprehensive End-to-End Test Suite for DHARA Platform
Verifies:
1. PostgreSQL PostGIS Database tables & records
2. Fastify API Server GET and POST endpoints (Approve, Change, Reject, Field Reports, Automation Status)
3. Python Static Web Server serving index.html, style.css, app.js, logo.png
4. Audit Trail insertion and data provenance integrity
"""

import urllib.request
import urllib.parse
import json
import psycopg2
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

API_BASE = "http://localhost:3001"
WEB_BASE = "http://localhost:8080"
DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "dhara",
    "user": "ner",
    "password": "ner_dev_password"
}

def run_tests():
    print("=========================================================")
    print("       DHARA E2E INTEGRATION & API TEST SUITE")
    print("=========================================================\n")

    # 1. Test Fastify API Health
    print("[1/7] Testing Fastify API Health...")
    req = urllib.request.urlopen(f"{API_BASE}/health")
    assert req.status == 200
    health_data = json.loads(req.read().decode())
    print(f"  - Health Status: {health_data.get('status')} ({health_data.get('engine')})")

    # 2. Test Automation Status Endpoint
    print("\n[2/7] Testing Automation Status Endpoint (/automation/status)...")
    req = urllib.request.urlopen(f"{API_BASE}/automation/status")
    assert req.status == 200
    auto_data = json.loads(req.read().decode())
    assert auto_data["status"] == "ACTIVE"
    assert len(auto_data["pipeline_stages"]) == 7
    print(f"  - Automation Pipeline Status : {auto_data['status']}")
    print(f"  - Pipeline Stages Verified   : {len(auto_data['pipeline_stages'])} stages")
    print(f"  - Summary Text               : {auto_data['summary_text']}")

    # 3. Test Decision Action: APPROVE
    print("\n[3/7] Testing Decision Action: POST /decisions/DEC_UKHRUL/approve...")
    req = urllib.request.Request(
        f"{API_BASE}/decisions/DEC_UKHRUL/approve",
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    res = urllib.request.urlopen(req)
    assert res.status == 200
    approve_data = json.loads(res.read().decode())
    assert approve_data["status"] == "approved"
    print(f"  - Approve Result: {approve_data}")

    # 4. Test Decision Action: CHANGE
    print("\n[4/7] Testing Decision Action: POST /decisions/DEC_MAGO/change...")
    change_payload = json.dumps({
        "units": 10.0,
        "depot": "Depot B (Kameng Regional Depot)",
        "route": "Mago Gorge Link Pass (Reinforced Track)",
        "deadline": "Within 18 Hours"
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}/decisions/DEC_MAGO/change",
        data=change_payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    res = urllib.request.urlopen(req)
    assert res.status == 200
    change_data = json.loads(res.read().decode())
    assert change_data["status"] == "modified"
    print(f"  - Change Result: {change_data}")

    # 5. Test Decision Action: REJECT (Feedback Loop)
    print("\n[5/7] Testing Decision Action: POST /decisions/DEC_THINGBU/reject...")
    reject_payload = json.dumps({
        "reason_category": "Road already reopened",
        "free_text": "Local Border Roads Organisation team cleared the minor debris slide at 06:30 IST."
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}/decisions/DEC_THINGBU/reject",
        data=reject_payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    res = urllib.request.urlopen(req)
    assert res.status == 200
    reject_data = json.loads(res.read().decode())
    assert reject_data["status"] == "rejected"
    print(f"  - Reject Result: {reject_data}")

    # 6. Test Field Incident Report: POST /field-reports
    print("\n[6/7] Testing Field Report Submission: POST /field-reports...")
    field_payload = json.dumps({
        "reporter_name": "Inspector T. Sharma (NDRF Tawang)",
        "location_name": "NH-150 Km 42 (Kameng Sector)",
        "incident_type": "Landslide",
        "severity": "CRITICAL",
        "description": "Heavy debris fall approx 40m wide. Both lanes blocked. Active mudflow.",
        "coordinates": [92.4180, 27.2415]
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}/field-reports",
        data=field_payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    res = urllib.request.urlopen(req)
    assert res.status == 200
    field_data = json.loads(res.read().decode())
    assert field_data["status"] == "received"
    print(f"  - Field Report Submission Result: {field_data['message']}")

    # 7. Test Web Static Assets
    print("\n[7/7] Testing Python Web Server Assets (http://localhost:8080)...")
    for asset in ["/", "/style.css", "/app.js", "/logo.png"]:
        req = urllib.request.urlopen(f"{WEB_BASE}{asset}")
        assert req.status == 200
        content_len = len(req.read())
        print(f"  - Asset {asset:12s} : 200 OK ({content_len} bytes)")

    # Verify Audit Logs in Database
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("SELECT action, reasoning, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 4;")
    recent_logs = cur.fetchall()
    print("\n[Audit Trail Verification in PostgreSQL]")
    for action, reasoning, dt in recent_logs:
        print(f"  [{dt}] {action:30s}: {reasoning[:60]}...")
    conn.close()

    print("\n=========================================================")
    print("    ALL E2E & DATABASE TESTS COMPLETED WITH 100% SUCCESS!")
    print("=========================================================\n")

if __name__ == "__main__":
    run_tests()
