import psycopg
from datetime import datetime, timezone

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

# 今天0点
today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
print(f"删除 deadline_at < {today} 的宣讲会")

# 先看有多少
cur.execute("SELECT COUNT(*) FROM jobs WHERE job_type='招聘会' AND deadline_at < %s", (today,))
expired = cur.fetchone()[0]
print(f"过期: {expired} 条")

# 看还剩多少
cur.execute("SELECT COUNT(*) FROM jobs WHERE job_type='招聘会' AND deadline_at >= %s", (today,))
active = cur.fetchone()[0]
print(f"有效: {active} 条")

# 删除
cur.execute("DELETE FROM jobs WHERE job_type='招聘会' AND deadline_at < %s", (today,))
deleted = cur.rowcount
conn.commit()
print(f"已删除: {deleted} 条")

conn.close()
