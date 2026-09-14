import psycopg
conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()
cur.execute("UPDATE jobs SET job_type='宣讲会' WHERE job_type='招聘会'")
print(f"更新: {cur.rowcount} 条")
conn.commit()
conn.close()
