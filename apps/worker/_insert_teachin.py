"""
将宣讲会数据写入 Supabase jobs 表
jobType='招聘会'
"""
import json
import uuid
import psycopg
from datetime import datetime

with open("E:/AIMemory/DaoBao/offer-hui/apps/worker/_teachin_data.json", "r", encoding="utf-8") as f:
    items = json.load(f)

print(f"共 {len(items)} 条宣讲会")

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

inserted = 0
skipped = 0
company_cache = {}

for item in items:
    company_name = item["company"].strip()
    
    # 解析时间
    try:
        dt = datetime.strptime(item["time"], "%Y-%m-%d %H:%M-%H:%M")
    except:
        dt = None
    
    title = f"{company_name} 宣讲会"
    
    # 查或建 company
    if company_name not in company_cache:
        cur.execute("SELECT id FROM companies WHERE name=%s", (company_name,))
        row = cur.fetchone()
        if row:
            company_id = row[0]
        else:
            company_id = uuid.uuid4()
            slug = company_name.replace(" ", "").replace("（", "").replace("）", "")[:50]
            cur.execute(
                "INSERT INTO companies (id, name, slug, created_at, updated_at) VALUES (%s, %s, %s, NOW(), NOW())",
                (company_id, company_name, slug),
            )
        company_cache[company_name] = company_id
    else:
        company_id = company_cache[company_name]
    
    # 去重
    external_id = f"teachin_{company_name}_{item['time']}".replace(" ", "_")
    cur.execute(
        "SELECT id FROM jobs WHERE external_id=%s",
        (external_id,),
    )
    if cur.fetchone():
        skipped += 1
        continue
    
    # 插入
    cur.execute(
        """INSERT INTO jobs (id, company_id, external_id, title, city, job_type, degree, deadline_at, source, source_url, apply_url, created_at, updated_at)
           VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())""",
        (
            company_id,
            external_id,
            title,
            "福州",
            "招聘会",
            "不限",
            dt,
            "福建理工大学就业网",
            "https://fjut.jysd.com/teachin",
            "https://fjut.jysd.com/teachin",
        ),
    )
    inserted += 1

conn.commit()
conn.close()
print(f"新增: {inserted}, 跳过(重复): {skipped}")
