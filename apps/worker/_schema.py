import psycopg

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

# 模拟 RLS：用 user_id 查
cur.execute("SET role anon; SET request.jwt.claims = '{\"sub\": \"85c9b974-cf6d-494a-a3f7-cacc18bd0d59\"}'::json;")
cur.execute("SELECT job_id, status FROM user_jobs WHERE user_id = '85c9b974-cf6d-494a-a3f7-cacc18bd0d59'")
rows = cur.fetchall()
print(f"模拟 anon 用户查询: {len(rows)} 条")
for row in rows:
    print(f"  {row[1]} | {row[0]}")

conn.close()
