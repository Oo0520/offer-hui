import psycopg
from datetime import datetime, timezone

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

# 从 external_id 提取时间
# 格式: teachin_公司名_2026-09-14_18:00-21:00
cur.execute("SELECT id, external_id FROM jobs WHERE job_type='招聘会' AND deadline_at IS NULL")
rows = cur.fetchall()
print(f"待更新: {len(rows)} 条")

updated = 0
for job_id, ext_id in rows:
    # 提取时间部分：teachin_公司_2026-09-14_18:00-21:00
    parts = ext_id.split("_")
    # 找日期部分
    for p in parts:
        if p.startswith("2026-") or p.startswith("2025-") or p.startswith("2027-"):
            date_str = p
            break
    else:
        continue
    # 时间在日期后面
    idx = parts.index(date_str)
    if idx + 1 < len(parts):
        time_str = parts[idx + 1].split("-")[0]  # 18:00-21:00 -> 18:00
        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        cur.execute("UPDATE jobs SET deadline_at=%s WHERE id=%s", (dt, job_id))
        updated += 1

conn.commit()
print(f"更新: {updated} 条")

# 删除过期的
today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
cur.execute("DELETE FROM jobs WHERE job_type='招聘会' AND deadline_at < %s", (today,))
deleted = cur.rowcount
conn.commit()
print(f"删除过期: {deleted} 条")

cur.execute("SELECT COUNT(*) FROM jobs WHERE job_type='招聘会'")
print(f"剩余有效: {cur.fetchone()[0]} 条")

conn.close()
