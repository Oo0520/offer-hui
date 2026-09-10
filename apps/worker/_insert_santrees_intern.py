import psycopg
import uuid
import json
from datetime import datetime, timezone

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

# 找三棵树公司
cur.execute("SELECT id FROM companies WHERE name = '三棵树'")
company_id = cur.fetchone()[0]
print(f"公司: {company_id}")

# 先删掉之前那条综合实习岗
cur.execute("DELETE FROM jobs WHERE external_id = 'zhaopin_santrees_三棵树2027届实习生' AND source = 'zhaopin_h5'")
print(f"删除旧综合实习岗: {cur.rowcount} 条")

# 12 个具体实习岗位
intern_jobs = [
    ("行政接待类实习生", "福建莆田", "本科及以上", "旅游管理、公共管理、行政管理、空乘等相关专业优先"),
    ("数智实践营实习生", "线上实习或莆田线下实习", "本科及以上", "计算机、软件、大数据、人工智能、信息管理等专业优先"),
    ("营销类实习生", "全国各地双向择地", "本科及以上", "专业不限"),
    ("产品运营类实习生", "福建莆田、上海", "本科及以上", "市场营销、经济类、管理类专业优先"),
    ("供应链类实习生", "福建莆田、四川邛崃", "本科及以上", "化学化工、机械、设备、采购、物流等相关专业优先"),
    ("技术类实习生", "福建莆田、安徽明光、河南濮阳", "本科及以上", "化学、化工、高分子、材料等相关专业"),
    ("质量检测岗实习生", "四川邛崃、安徽明光、湖北应城", "本科及以上", "化学、化工、高分子、材料、生物工程等相关专业"),
    ("人力资源岗实习生", "福建莆田、上海", "本科及以上", "人力资源、工商管理等相关专业优先"),
    ("数智化类实习生", "福建莆田", "本科及以上", "计算机、软件、数学、统计学、数据库管理、信管等相关专业"),
    ("财务岗实习生", "福建莆田、安徽明光", "本科及以上", "财务、会计、金融、经济、统计、工商管理等相关专业"),
    ("空间&平面设计岗实习生", "上海", "本科及以上", "建筑学、艺术设计、环境设计、室内设计等相关专业"),
    ("法务类实习生", "福建莆田", "本科及以上", "法律相关专业"),
]

source = "zhaopin_h5"
source_url = "https://webapp.zhaopin.com/2025/hd/fjsks0825ZL82493/"
apply_url = "https://webapp.zhaopin.com/2025/hd/fjsks0825ZL82493/#/pages/jobs2/index"

inserted = 0
for title, city, degree, desc in intern_jobs:
    external_id = f"zhaopin_santrees_{title}"
    cur.execute("SELECT id FROM jobs WHERE external_id = %s AND source = %s", (external_id, source))
    if cur.fetchone():
        print(f"  跳过(已存在): {title}")
        continue
    cur.execute(
        """
        INSERT INTO jobs (
            id, company_id, source, source_url, external_id,
            title, description, city, job_type, degree,
            cohort, apply_url, status, is_hot, is_intern, tags,
            posted_at, created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            str(uuid.uuid4()), company_id, source, source_url, external_id,
            title, desc, city, "实习", degree,
            "2027届", apply_url, "published", False, True, json.dumps(["实习", "三棵树"]),
            datetime.now(timezone.utc), datetime.now(timezone.utc), datetime.now(timezone.utc),
        ),
    )
    inserted += 1
    print(f"  插入: {title}")

conn.commit()
print(f"\n完成: 插入 {inserted} 个实习岗位")
conn.close()
