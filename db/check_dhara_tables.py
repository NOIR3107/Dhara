"""Quick check of DHARA database table row counts."""
import psycopg2

DB = dict(host="localhost", port=5433, dbname="dhara", user="ner", password="ner_dev_password")

conn = psycopg2.connect(**DB)
cur = conn.cursor()
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name NOT IN ('spatial_ref_sys','geography_columns','geometry_columns')
    ORDER BY table_name;
""")
tables = [r[0] for r in cur.fetchall()]

for t in tables:
    cur.execute(f'SELECT COUNT(*) FROM "{t}";')
    print(f"  {t:30s} {cur.fetchone()[0]} rows")
conn.close()
