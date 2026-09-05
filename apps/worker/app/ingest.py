# -*- coding: utf-8 -*-
"""数据管道主流程：抓取各源 → 去重入库 → 增量清理 → 统计。"""
import asyncio

import httpx

from .config import settings
from .models import Job
from .sources.base import BaseSource
from .sources.fj99 import Fj99Source
from .sources.fjrclh import FjrclhSource
from .sources.fjut import FjutSource
from .storage import PostgresStorage


def get_storage():
    return PostgresStorage(settings.database_url)


def get_sources(client: httpx.AsyncClient) -> list[BaseSource]:
    return [
        FjutSource(client),
        FjrclhSource(client),
        Fj99Source(client),
    ]


async def run_pipeline(dry_run: bool = False) -> dict:
    """执行一次全量抓取。返回每个源的统计。"""
    storage = get_storage()
    results: dict = {}
    async with httpx.AsyncClient(
        timeout=20, follow_redirects=True
    ) as client:
        for src in get_sources(client):
            stat = {"found": 0, "new": 0, "updated": 0, "skipped": 0, "error": ""}
            alive: set = set()
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
            except Exception as e:
                stat["error"] = f"{type(e).__name__}: {e}"
            results[src.name] = stat
    return {
        "backend": settings.storage_backend,
        "results": results,
        "stats": storage.stats(),
    }
