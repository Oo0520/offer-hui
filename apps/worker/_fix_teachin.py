import psycopg
from datetime import datetime, timezone

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

# 先看统计
cur.execute("SELECT COUNT(*) FROM jobs WHERE job_type='宣讲会'")
total = cur.fetchone()[0]
print(f"宣讲会总数: {total}")

cur.execute("SELECT COUNT(*) FROM jobs WHERE job_type='宣讲会' AND deadline_at IS NOT NULL AND deadline_at >= %s", (today,))
active = cur.fetchone()[0]
print(f"有效(未来): {active}")

cur.execute("SELECT COUNT(*) FROM jobs WHERE job_type='宣讲会' AND (deadline_at IS NULL OR deadline_at < %s)", (today,))
expired = cur.fetchone()[0]
print(f"过期/无时间: {expired}")

# 删除过期的
cur.execute("DELETE FROM jobs WHERE job_type='宣讲会' AND (deadline_at IS NULL OR deadline_at < %s)", (today,))
deleted = cur.rowcount
conn.commit()
print(f"\n已删除: {deleted} 条")

cur.execute("SELECT COUNT(*) FROM jobs WHERE job_type='宣讲会'")
print(f"剩余有效: {cur.fetchone()[0]} 条")
conn.close()
