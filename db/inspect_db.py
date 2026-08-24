"""Inspect PostgreSQL databases, tables, row counts and PostGIS status."""
import psycopg2, json, sys

def inspect(dbname='postgres', user='postgres', password='postgres', host='localhost', port=5432):
    results = {}
    try:
        conn = psycopg2.connect(host=host, port=port, dbname=dbname, user=user, password=password)
        cur = conn.cursor()
    except Exception as e:
        print(f"CONNECTION FAILED: {e}")
        return

    # Version
    cur.execute("SELECT version()")
    results["pg_version"] = cur.fetchone()[0]

    # Databases
    cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")
    results["databases"] = [r[0] for r in cur.fetchall()]

    # PostGIS check
    cur.execute("SELECT extname, extversion FROM pg_extension")
    results["extensions"] = [{"name": r[0], "version": r[1]} for r in cur.fetchall()]

    conn.close()

    # For each database, list tables and row counts
    results["database_details"] = {}
    for db in results["databases"]:
        try:
            c2 = psycopg2.connect(host=host, port=port, dbname=db, user=user, password=password)
            cr = c2.cursor()

            # PostGIS in this DB?
            cr.execute("SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'")
            postgis = cr.fetchall()

            # Tables
            cr.execute("""
                SELECT table_schema, table_name 
                FROM information_schema.tables 
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_schema, table_name
            """)
            tables = cr.fetchall()

            table_info = []
            for schema, tname in tables:
                try:
                    cr.execute(f'SELECT count(*) FROM "{schema}"."{tname}"')
                    cnt = cr.fetchone()[0]
                except Exception:
                    cnt = "ERROR"
                
                # Columns
                cr.execute(f"""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = %s AND table_name = %s 
                    ORDER BY ordinal_position
                """, (schema, tname))
                cols = [{"name": r[0], "type": r[1]} for r in cr.fetchall()]
                
                table_info.append({
                    "schema": schema,
                    "table": tname,
                    "row_count": cnt,
                    "columns": cols
                })

            results["database_details"][db] = {
                "postgis": postgis,
                "tables": table_info
            }
            c2.close()
        except Exception as e:
            results["database_details"][db] = {"error": str(e)}

    print(json.dumps(results, indent=2, default=str))

if __name__ == "__main__":
    inspect()
