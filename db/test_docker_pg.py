import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def test_docker_pg():
    try:
        conn = psycopg2.connect(
            host="localhost",
            port=5433,
            dbname="ner_logistics",
            user="ner",
            password="ner_dev_password"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute("SELECT version();")
        print("Connected successfully:", cur.fetchone()[0])
        
        # Check postgis
        cur.execute("SELECT PostGIS_Full_Version();")
        print("PostGIS version:", cur.fetchone()[0])

        # Create dhara database if not exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname='dhara'")
        if not cur.fetchone():
            cur.execute("CREATE DATABASE dhara")
            print("Created database 'dhara'")
        else:
            print("Database 'dhara' already exists")
            
        conn.close()

        # Connect to dhara
        conn_dhara = psycopg2.connect(
            host="localhost",
            port=5433,
            dbname="dhara",
            user="ner",
            password="ner_dev_password"
        )
        conn_dhara.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur_d = conn_dhara.cursor()
        cur_d.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        print("PostGIS extension installed/verified on 'dhara' database!")
        conn_dhara.close()

    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_docker_pg()
