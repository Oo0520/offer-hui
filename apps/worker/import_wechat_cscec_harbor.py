# -*- coding: utf-8 -*-
"""一次性：中建港航局 2027 届校招（公众号，按 8 专业大类）→ 云库。

来源：中建港航局公众号《中建港航局2027届校园招聘正式启动》2026-09-07
https://mp.weixin.qq.com/s/MEdYFpB611C3G4Ff2N6jKA
投递：https://hcm.pub/pe634
用法：python import_wechat_cscec_harbor.py
"""
from app.ingest import get_storage
from app.models import Job

ARTICLE_URL = "https://mp.weixin.qq.com/s/MEdYFpB611C3G4Ff2N6jKA"
APPLY_URL = "https://hcm.pub/pe634"
COMPANY = "中建港航局集团有限公司"

# (大类, 专业要求, 主地点, 地点标签)
ROWS = [
    ("工程技术类", "港口航道与海岸工程、土木工程、水利水电工程、道路桥梁与渡河工程、给排水工程、轨道交通、隧道工程、城市地下空间工程、岩土工程、测绘工程等相关专业", "上海", "全国、海外"),
    ("商务类", "工程管理、工程造价等相关专业", "上海", "全国、海外"),
    ("材料类", "材料科学与工程、无机非金属材料等相关专业", "上海", "全国、海外"),
    ("机电类", "电气工程及其自动化、机械设计制造及其自动化、建筑环境与能源应用工程、建筑电气与智能化等相关专业", "上海", "全国、海外"),
    ("安全类", "安全工程、应急管理等相关专业", "上海", "全国、海外"),
    ("战新类", "智能建造、环境工程、物联网工程、新能源科学与工程等战新（新质）领域相关专业", "上海", "全国、海外"),
    ("金融财务类", "会计学、财务管理、金融学、经济学等相关专业", "上海", "全国、海外"),
    ("职能管理类", "汉语言文学、人力资源管理、网络与新媒体、新闻学、行政管理、工商管理、法学等相关专业", "上海", "全国、海外"),
]


def main():
    storage = get_storage()
    counters = {"new": 0, "updated": 0, "skipped": 0}
    for title, major, city, loc_tag in ROWS:
        job = Job(
            source="wechat",
            source_url=ARTICLE_URL,          # 权威来源：公众号原文
            external_id=f"cscec-harbor:{title}",
            title=f"{title}·2027届校招",
            company_name=COMPANY,
            city=city,
            industry="工程建设",
            job_type="campus",
            degree="本科及以上",
            cohort="2027届",
            salary_min=0, salary_max=0, salary_text="",
            deadline_at="",                  # 公告未标注，招满即止
            posted_at="2026-09-07",
            apply_url=APPLY_URL,             # 官方投递入口
            tags=["央企", "中建", loc_tag, major[:24]],
        )
        counters[storage.upsert_job(job)] += 1
    print(f"wechat(cscec-harbor) 导入 {len(ROWS)} 条 → {counters}")
    print("总览:", storage.stats())
    storage.close()


if __name__ == "__main__":
    main()
