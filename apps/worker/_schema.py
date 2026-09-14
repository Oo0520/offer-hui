import psycopg
conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()
# 恢复：原来的招聘会保留，新的宣讲会单独
# 现在 jobType=宣讲会 的 362 条保持不变，再看看有没有其他招聘会
cur.execute("SELECT DISTINCT job_type FROM jobs")
print("现有 jobType:", [r[0] for r in cur.fetchall()])
cur.execute("SELECT COUNT(*) FROM jobs WHERE job_type='招聘会'")
print("招聘会:", cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM jobs WHERE job_type='宣讲会'")
print("宣讲会:", cur.fetchone()[0])
conn.close()
