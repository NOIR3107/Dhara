import psycopg2

def check_tables():
    conn = psycopg2.connect(host='localhost', port=5433, dbname='dhara', user='ner', password='ner_dev_password')
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    print("All tables in dhara DB:", tables)
    conn.close()

if __name__ == "__main__":
    check_tables()
