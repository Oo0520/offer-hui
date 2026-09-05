# -*- coding: utf-8 -*-
"""一次性数据清洗：从标题回填届别(cohort) + 归一化城市(city)。
用法：cd apps/worker && .venv\\Scripts\\python.exe scripts\\backfill_jobs.py
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from supabase import create_client


def extract_cohort(title: str) -> str:
    """从标题提取届别：2027届 / 2027校园招聘 / 2026年秋招 → '2027届' 等。"""
    m = re.search(r"(20\d{2})\s*届", title)
    if m:
        return f"{m.group(1)}届"
    m = re.search(r"(20\d{2})\s*(?:校园招聘|校园|校招|秋季招聘|春季招聘|秋招|春招)", title)
    if m:
        return f"{m.group(1)}届"
    m = re.search(r"(20\d{2})\s*年[^\s，。]*(?:秋|春)?招", title)
    if m:
        return f"{m.group(1)}届"
    return ""


def norm_city(city: str) -> str:
    if not city:
        return ""
    if city in ("全国", "不限"):
        return city
    return re.sub(r"(省|市)$", "", city)


def main():
    c = create_client(settings.supabase_url, settings.supabase_service_key)
    rows = c.table("jobs").select("id,title,city,cohort").execute().data
    print(f"读取 {len(rows)} 条岗位")

    up = 0
    for r in rows:
        new_cohort = extract_cohort(r["title"])
        new_city = norm_city(r.get("city") or "")
        if new_cohort != (r.get("cohort") or "") or new_city != (r.get("city") or ""):
            patch = {}
            if new_cohort:
                patch["cohort"] = new_cohort
            if new_city:
                patch["city"] = new_city
            c.table("jobs").update(patch).eq("id", r["id"]).execute()
            up += 1
    print(f"更新 {up} 条")

    # 回显届别分布
    dist = {}
    for r in c.table("jobs").select("cohort").execute().data:
        k = r.get("cohort") or "（未标注）"
        dist[k] = dist.get(k, 0) + 1
    for k, v in sorted(dist.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
