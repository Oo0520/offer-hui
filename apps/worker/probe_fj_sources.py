# -*- coding: utf-8 -*-
"""快速验证三个福建源的解析结果（不写库）。"""
import asyncio
import json

import httpx

from app.config import settings
from app.sources.fj99 import Fj99Source
from app.sources.fjrclh import FjrclhSource
from app.sources.fjut import FjutSource


async def main():
    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
        for cls in (FjutSource, FjrclhSource, Fj99Source):
            src = cls(client)
            try:
                items = await src.fetch()
                print(f"\n=== {src.label} ({src.name}) 共 {len(items)} 条 ===")
                for j in items[:5]:
                    print(f"  [{j.job_type}] {j.title[:30]} | {j.company_name[:18]} | "
                          f"{j.city[:12]} | {j.degree[:10]} | {j.salary_text[:14]} | 截止:{j.deadline_at} | {j.external_id[:20]}")
            except Exception as e:
                print(f"\n=== {src.label} 失败: {type(e).__name__}: {e}")


asyncio.run(main())
