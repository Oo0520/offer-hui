import psycopg

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

# 加 email 和 role 列
cur.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT")
cur.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'")
cur.execute("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()")

# 给现有用户创建 profile
cur.execute("""
  INSERT INTO profiles (id, username, email)
  SELECT id, email, email FROM auth.users
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
""")
print(f"补建 profile: {cur.rowcount} 条")
conn.commit()

# 验证
cur.execute("SELECT id, username, email, role FROM profiles")
for row in cur.fetchall():
    print(f"  {row[1]} | {row[2]} | {row[3]}")

conn.close()
