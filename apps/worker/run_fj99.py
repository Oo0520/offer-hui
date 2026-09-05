# -*- coding: utf-8 -*-
"""仅重跑 fj99 源并 upsert（上次 crawl 中途中断，53 条未更新）。"""
import asyncio
import json

import httpx

from app.config import settings
from app.ingest import get_storage
from app.sources.fj99 import Fj99Source


async def main():
    storage = get_storage()
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        src = Fj99Source(client)
        items = await src.fetch()
        stat = {"found": 0, "new": 0, "updated": 0, "skipped": 0}
        stat["found"] = len(items)
        alive = set()
        for job in items:
            alive.add(job.external_id)
            stat[storage.upsert_job(job)] += 1
        print(json.dumps({"fj99": stat}, ensure_ascii=False, indent=2))


asyncio.run(main())
