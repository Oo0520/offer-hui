import psycopg
import uuid
import json
from datetime import datetime, timezone

conn = psycopg.connect(
    "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    prepare_threshold=None,
)
cur = conn.cursor()

# 确认公司
cur.execute("SELECT id FROM companies WHERE name = '三棵树'")
row = cur.fetchone()
if row:
    company_id = row[0]
    print(f"公司已存在: {company_id}")
else:
    cur.execute(
        "INSERT INTO companies (id, name, slug, industry, scale) VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (str(uuid.uuid4()), "三棵树", "santrees", "化工建材", "10000人以上"),
    )
    company_id = cur.fetchone()[0]
    print(f"公司已创建: {company_id}")

# 19 个应届生岗位 + 1 个实习
jobs = [
    # (title, city, degree, job_type, description)
    ("营销业务类C端", "全国各地双向择地", "本科及以上", "校招", "营销业务类C端方向，专业不限"),
    ("营销业务类B端", "全国各地双向择地", "本科及以上", "校招", "营销业务类B端方向，专业不限"),
    ("仿石漆营销岗", "全国各地双向择地", "本科及以上", "校招", "仿石漆方向营销岗，专业不限"),
    ("海外营销岗", "上海", "本科及以上", "校招", "海外营销，专业不限，英语或小语种优先，工作地点：东南亚、中东非、拉丁美洲"),
    ("产品管理岗", "福建莆田、上海", "本科及以上", "校招", "化学化工、高分子、材料等相关专业优先"),
    ("市场推广岗", "全国各地双向择地", "本科及以上", "校招", "市场推广方向，专业不限"),
    ("供应链-生产管理类", "福建莆田、四川邛崃、安徽明光、广西贺州", "本科及以上", "校招", "化工、材料、化工工艺、化学相关专业"),
    ("供应链-计划类", "福建莆田", "本科及以上", "校招", "管理工程与科学、统计学、化工材料、数学等相关专业"),
    ("供应链-采购类", "福建莆田", "本科及以上", "校招", "化工材料、管理科学与工程、统计学、数学等相关专业"),
    ("供应链-物流管理类", "福建莆田、广西贺州", "本科及以上", "校招", "物流管理、物流工程等相关专业"),
    ("供应链-环境安全类", "福建莆田", "本科及以上", "校招", "化工、安全工程、环境工程等相关专业"),
    ("供应链-机电类", "四川邛崃、安徽明光", "本科及以上", "校招", "机械工程、电气工程、自动化、机电一体化等相关专业"),
    ("质量检测岗", "福建莆田、四川邛崃、安徽明光、湖北应城", "本科及以上", "校招", "化学、化工、高分子、材料、生物工程等相关专业"),
    ("数智化产品与项目工程师", "福建莆田、上海、北京", "本科及以上", "校招", "计算机、产品设计、软件工程、行政管理、中文等相关专业"),
    ("场景AI应用工程师", "福建莆田", "本科及以上", "校招", "计算机、人工智能、数据科学、自动化、供应链管理、工业工程等相关专业"),
    ("AI技术与智能化工程师", "福建莆田、北京", "本科及以上", "校招", "计算机、人工智能、软件工程、自动化、物联网等相关专业"),
    ("品牌岗", "福建莆田", "本科及以上", "校招", "美术、设计、动画影视、视觉传达、广告传播、广播电视编导、新闻传播学、汉语言文学、广告学、新媒体等专业"),
    ("财务岗", "福建莆田", "本科及以上", "校招", "会计、税务、审计、金融、财务等相关专业"),
    ("行政接待岗", "广西贺州、上海", "本科及以上", "校招", "专业不限，播音、中文、行政管理、旅游管理、空乘等专业优先"),
    # 实习
    ("三棵树2027届实习生", "福建莆田、上海、四川邛崃、安徽明光、湖北应城、河南濮阳", "本科及以上", "实习", "营销类、技术类、供应链类、后勤职能类（数智化、财务、人力资源）等岗位均开放，2027届大学生可投，包吃包住，择优录用，提前转正"),
]

source = "zhaopin_h5"
source_url = "https://webapp.zhaopin.com/2025/hd/fjsks0825ZL82493/"
apply_url = "https://webapp.zhaopin.com/2025/hd/fjsks0825ZL82493/#/pages/jobs2/index"

inserted = 0
skipped = 0

for title, city, degree, job_type, desc in jobs:
    external_id = f"zhaopin_santrees_{title}"
    # 去重：检查是否已存在
    cur.execute("SELECT id FROM jobs WHERE external_id = %s AND source = %s", (external_id, source))
    if cur.fetchone():
        skipped += 1
        print(f"  跳过(已存在): {title}")
        continue

    cur.execute(
        """
        INSERT INTO jobs (
            id, company_id, source, source_url, external_id,
            title, description, city, job_type, degree,
            cohort, apply_url, status, is_hot, is_intern, tags,
            posted_at, created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s
        )
        """,
        (
            str(uuid.uuid4()), company_id, source, source_url, external_id,
            title, desc, city, job_type, degree,
            "2027届", apply_url, "published", False, job_type == "实习", json.dumps(["校招", "三棵树"]),
            datetime.now(timezone.utc), datetime.now(timezone.utc), datetime.now(timezone.utc),
        ),
    )
    inserted += 1
    print(f"  插入: {title}")

conn.commit()
print(f"\n完成: 插入 {inserted} 条, 跳过 {skipped} 条")
conn.close()
