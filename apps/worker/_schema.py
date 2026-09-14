import psycopg

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

# 查 user_jobs 的 RLS 策略
cur.execute("""
  SELECT policyname, cmd, qual FROM pg_policies WHERE tablename='user_jobs'
""")
print("user_jobs RLS 策略:")
for row in cur.fetchall():
    print(f"  {row[1]}: {row[0]} | USING: {row[2]}")

# 查 user_jobs 表的 RLS 是否开启
cur.execute("SELECT relrowsecurity FROM pg_class WHERE relname='user_jobs'")
print(f"\nRLS 开启: {cur.fetchone()[0]}")

# 看 user_jobs 里的 user_id 是谁的
cur.execute("SELECT user_id, job_id, status FROM user_jobs LIMIT 5")
print("\nuser_jobs 数据:")
for row in cur.fetchall():
    print(f"  user={row[0]} | job={row[1]} | status={row[2]}")

conn.close()
