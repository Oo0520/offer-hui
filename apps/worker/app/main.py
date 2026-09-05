# -*- coding: utf-8 -*-
"""FastAPI 入口：健康检查 + 手动触发爬取 + 岗位查询。"""
import asyncio

from fastapi import FastAPI, Query

from .config import settings
from .ingest import get_storage, run_pipeline

app = FastAPI(title="OfferHub Worker API", version="0.1.0")


@app.get("/healthz")
def healthz():
    st = get_storage()
    stats = st.stats()
    return {"status": "ok", "backend": settings.storage_backend, "jobs_total": stats.get("total", 0)}


@app.post("/crawl")
def crawl(dry_run: bool = False):
    """触发一次抓取（dry_run=true 只统计不写库，用于验证）。"""
    return asyncio.run(run_pipeline(dry_run=dry_run))


@app.get("/jobs")
def jobs(
    limit: int = Query(50, ge=1, le=200),
    status: str = Query("published"),
    source: str | None = Query(None),
):
    st = get_storage()
    rows = st.list_jobs(limit=limit, status=status)
    if source:
        rows = [r for r in rows if r["source"] == source]
    return {"count": len(rows), "jobs": rows}
