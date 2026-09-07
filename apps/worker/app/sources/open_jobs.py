# -*- coding: utf-8 -*-
"""open-jobs-data · 社区维护的开放岗位数据集（ConorsCode/open-jobs-data，MIT）。

数据通道：raw.githubusercontent.com/ConorsCode/open-jobs-data/main/data/jobs.json
形态：每日更新的 JSON，约 3.7 万条，来自 9 种 ATS 的公开职位 feed（国外公司为主）。
本源只筛选"中国相关"岗位（locations 含中国城市/Remote China），作为外企补充。
"""
import re

from ..models import Job
from .base import BaseSource

JOBS_URL = "https://raw.githubusercontent.com/ConorsCode/open-jobs-data/main/data/jobs.json"

# 中国相关地点关键词（匹配 locations 任一字段）
_CN = re.compile(
    r"(China|Beijing|Shanghai|Shenzhen|Guangzhou|Hangzhou|Hong Kong|"
    r"Nanjing|Chengdu|Suzhou|Wuhan|Xi.?an|Remote \(China\))",
    re.I,
)
# locations 中提取城市 → city 字段
_CITY = re.compile(
    r"(Beijing|Shanghai|Shenzhen|Guangzhou|Hangzhou|Hong Kong|Nanjing|Chengdu|Suzhou|Wuhan)",
    re.I,
)


class OpenJobsDataSource(BaseSource):
    name = "open_jobs"
    label = "open-jobs-data 开放数据集"

    async def fetch(self) -> list:
        resp = await self._get(JOBS_URL)
        return self._filter(resp.json())

    def _filter(self, rows: list) -> list:
        jobs = []
        for row in rows:
            locs = row.get("locations") or []
            if not any(_CN.search(l) for l in locs):
                continue
            city = next((m.group(1).title() for l in locs for m in [_CITY.search(l)] if m), "中国")
            emp = (row.get("employmentType") or "").lower()
            jobs.append(Job(
                source=self.name,
                source_url=row.get("applyUrl") or "",
                external_id=f"{row.get('platform')}:{row.get('jobId')}",
                title=row.get("title") or "",
                company_name=row.get("company") or "",
                city=city,
                industry=row.get("department") or "外企",
                job_type="intern" if "intern" in emp else "campus",
                degree="",
                cohort="",
                posted_at=(row.get("postedAt") or "")[:10],
                apply_url=row.get("applyUrl") or "",
                tags=["外企", row.get("platform") or ""],
            ))
        return jobs
