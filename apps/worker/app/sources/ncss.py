# -*- coding: utf-8 -*-
"""国家24365（job.ncss.cn）：JSONP 公开接口，官方权威源。"""
import json

from ..models import Job
from .base import BaseSource


class NcssSource(BaseSource):
    name = "ncss"
    label = "国家24365"

    BASE = "https://job.ncss.cn"
    ENDPOINTS = [
        ("uptodate", "/student/api/zeyuanhome/uptodatejobs/"),  # 最新职位
        ("intern", "/student/api/zeyuanhome/internships/"),     # 实习
        ("gyqy", "/student/api/zeyuanhome/gyqy/"),              # 国有企业
        ("property", "/student/api/zeyuanhome/property/"),      # 机关事业单位
        ("keyunits", "/student/api/zeyuanhome/keyunits/"),      # 重点领域
    ]

    async def fetch(self) -> list[Job]:
        jobs: list[Job] = []
        for kind, path in self.ENDPOINTS:
            try:
                resp = await self._get(
                    f"{self.BASE}{path}", params={"callback": "cb1"}
                )
                payload = self._parse_jsonp(resp.text)
                if not payload.get("flag"):
                    continue
                for item in (payload.get("data") or {}).get("list", []):
                    job = self._to_job(item, kind)
                    if job.title and job.external_id:
                        jobs.append(job)
            except Exception as e:  # 单接口失败不阻断整体
                print(f"[ncss:{kind}] 抓取失败: {type(e).__name__}: {e}")
        return jobs

    @staticmethod
    def _parse_jsonp(text: str) -> dict:
        t = text.strip()
        # JSONP 包装：cb1({...})；或纯 JSON
        if t.startswith("cb1(") and t.endswith(")"):
            t = t[4:-1]
        return json.loads(t)

    def _to_job(self, item: dict, kind: str) -> Job:
        job_id = item.get("jobId", "")
        source_url = f"{self.BASE}/student/jobs/{job_id}/detail.html"
        low = item.get("lowMonthPay") or 0
        high = item.get("highMonthPay") or 0
        job = Job(
            source=self.name,
            source_url=source_url,
            external_id=job_id,
            title=item.get("jobName", ""),
            company_name=item.get("corpName", ""),
            city=item.get("areaName", ""),
            industry=item.get("primaryIndustryName", "") or "",
            degree=item.get("degreeName", "") or "",
            salary_min=float(low) if low else 0,
            salary_max=float(high) if high else 0,
            salary_text=f"{low}-{high}K" if high else "",
            apply_url=source_url,  # 官方投递入口（详情页）
            tags=[t.strip() for t in (item.get("corpTags") or "").split(",") if t.strip()],
            job_type="intern" if kind == "intern" else "campus",
        )
        job.content_hash = job.compute_hash()
        return job
