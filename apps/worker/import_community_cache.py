# -*- coding: utf-8 -*-
"""一次性：用本地缓存导入社区源数据（campus2027 / open_jobs）。

背景：GitHub raw 网络暂不可达，本地已有完整缓存文件，先导入让数据上线；
网络恢复后定时任务按 content_hash 增量更新，不会重复。
用法：python import_community_cache.py
"""
import json

from app.ingest import get_storage
from app.sources.campus2027 import Campus2027Source
from app.sources.open_jobs import OpenJobsDataSource

CACHE = {
    "campus2027": "_campus2027_readme.md",
    "open_jobs": "_ojd_jobs.json",
}


def main():
    storage = get_storage()
    counters = {"new": 0, "updated": 0, "skipped": 0}
    # campus2027：README markdown
    text = open(CACHE["campus2027"], encoding="utf-8").read()
    src = Campus2027Source.__new__(Campus2027Source)
    items = src._parse(text)
    for job in items:
        counters[storage.upsert_job(job)] += 1
    print(f"campus2027 导入 {len(items)} 条 → {counters}")

    # open_jobs：jobs.json 筛选中国岗位
    rows = json.load(open(CACHE["open_jobs"], encoding="utf-8"))
    ojs = OpenJobsDataSource.__new__(OpenJobsDataSource)
    items = ojs._filter(rows)
    counters = {"new": 0, "updated": 0, "skipped": 0}
    for job in items:
        counters[storage.upsert_job(job)] += 1
    print(f"open_jobs 导入 {len(items)} 条 → {counters}")

    print("总览:", storage.stats())
    storage.close()


if __name__ == "__main__":
    main()
