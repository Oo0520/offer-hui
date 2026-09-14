import psycopg

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

with open("E:/AIMemory/DaoBao/offer-hui/apps/worker/_auth_schema.sql", "r", encoding="utf-8") as f:
    sql = f.read()

# 分段执行
for stmt in sql.split(";"):
    stmt = stmt.strip()
    if stmt and not stmt.startswith("--"):
        try:
            cur.execute(stmt)
        except Exception as e:
            print(f"跳过: {str(e)[:80]}")

conn.commit()
print("Schema 执行完成")

# 验证
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('profiles','user_jobs')")
for row in cur.fetchall():
    print(f"  表存在: {row[0]}")

conn.close()
