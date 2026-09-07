# -*- coding: utf-8 -*-
"""数据管道主流程：抓取各源 → 去重入库 → 增量清理 → 统计。"""
import asyncio
from datetime import datetime, timezone

import httpx

from .config import settings
from .models import Job
from .sources.base import BaseSource
from .sources.campus2027 import Campus2027Source
from .sources.feishu import FeishuSource
from .sources.fj99 import Fj99Source
from .sources.fjrclh import FjrclhSource
from .sources.fjut import FjutSource
from .sources.open_jobs import OpenJobsDataSource
from .storage import PostgresStorage


def get_storage():
    return PostgresStorage(settings.database_url)


# 数据源 → 监控分类（university 高校 / corporate 企业 / ncss 平台 / community 社区）
SOURCE_KIND = {
    "ncss": "ncss",
    "fjut": "university",
    "fjrclh": "university",
    "fj99": "university",
    "feishu_nio": "corporate",
    "feishu_mi": "corporate",
    "feishu_xiaopeng": "corporate",
    "campus2027": "community",
    "open_jobs": "community",
}


def get_sources(client: httpx.AsyncClient) -> list[BaseSource]:
    sources = [
        FjutSource(client),
        FjrclhSource(client),
        Fj99Source(client),
    ]
    # 社区维护开源数据源
    sources.append(Campus2027Source(client))
    sources.append(OpenJobsDataSource(client))
    # 飞书招聘系企业（Playwright，每个 tenant 一个实例）
    feishu_companies = [
        ("nio", "蔚来", "新能源汽车", "/campus"),
        ("mi", "小米", "消费电子/智能硬件", "/campus"),
        ("xiaopeng", "小鹏汽车", "新能源汽车", "/campus/position/list"),
    ]
    for tenant, name, industry, path in feishu_companies:
        sources.append(FeishuSource(client, tenant, name, industry, path))
    return sources


async def run_pipeline(dry_run: bool = False) -> dict:
    """执行一次全量抓取。返回每个源的统计（含 crawl_runs 监控记录）。"""
    storage = get_storage()
    results: dict = {}
    async with httpx.AsyncClient(
        timeout=20, follow_redirects=True
    ) as client:
        for src in get_sources(client):
            stat = {"found": 0, "new": 0, "updated": 0, "skipped": 0, "error": ""}
            alive: set = set()
            started = datetime.now(timezone.utc).isoformat()
            try:
                items: list[Job] = await src.fetch()
                stat["found"] = len(items)
                for job in items:
                    alive.add(job.external_id)
                    if dry_run:
                        continue
                    stat[storage.upsert_job(job)] += 1
                if not dry_run and hasattr(storage, "mark_expired"):
                    stat["expired"] = storage.mark_expired(src.name, alive)
                status = "success"
            except Exception as e:
                stat["error"] = f"{type(e).__name__}: {e}"
                status = "failed"
            finished = datetime.now(timezone.utc).isoformat()
            if not dry_run:
                storage.record_run(
                    src.name,
                    SOURCE_KIND.get(src.name, "other"),
                    started, finished, status,
                    stat["found"], stat["new"], stat["updated"], stat.get("expired", 0),
                    stat["error"],
                )
            results[src.name] = stat
    backend = settings.storage_backend
    stats = storage.stats()
    try:
        storage.close()
    except Exception:
        pass
    return {
        "backend": backend,
        "results": results,
        "stats": stats,
    }
