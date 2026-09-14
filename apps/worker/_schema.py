import psycopg

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

# 查 user_jobs 表存在吗
cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='user_jobs')")
print(f"user_jobs 表存在: {cur.fetchone()[0]}")

# 查 profiles 表
cur.execute("SELECT COUNT(*) FROM profiles")
print(f"profiles 用户数: {cur.fetchone()[0]}")

# 查 user_jobs 数据
cur.execute("SELECT COUNT(*) FROM user_jobs")
print(f"user_jobs 记录数: {cur.fetchone()[0]}")

# 看 auth.users 有多少用户
cur.execute("SELECT id, email, created_at FROM auth.users")
for row in cur.fetchall():
    print(f"  用户: {row[1]} | {row[2]}")

conn.close()
