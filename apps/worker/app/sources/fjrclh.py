# -*- coding: utf-8 -*-
"""福建人才联合网（福州大学主办，fjrclh.fzu.edu.cn）。

数据通道：POST /CmsInterface/getCmsList
  data = {"typeid": "1", "typedir": "zwxx", "pageSize": 50}
  返回最新 50 条岗位（无分页参数，取最新一批，MVP 够用）。
  另有 typedir: xjh(宣讲会) / zph(招聘会) 同接口。
"""
import re

from ..models import Job
from .base import BaseSource

API = "http://fjrclh.fzu.edu.cn/CmsInterface/getCmsList"


class FjrclhSource(BaseSource):
    name = "fjrclh"
    label = "福建人才联合网"
    _REFERER = "http://fjrclh.fzu.edu.cn/"

    async def _list(self, typedir: str, page_size: int = 50) -> list[dict]:
        resp = await self._post(
            API,
            data={"typeid": "1", "typedir": typedir, "pageSize": str(page_size)},
            referer=self._REFERER,
        )
        data = resp.json()
        if not data.get("success") and data.get("code") not in (0, "0", 200, "200"):
            print(f"[fjrclh] {typedir} 接口异常: {str(data)[:200]}")
            return []
        rows = data.get("list") or data.get("data") or data.get("result") or []
        if isinstance(rows, dict):
            rows = rows.get("list") or rows.get("records") or []
        return rows or []

    async def fetch(self) -> list:
        jobs: list[Job] = []
        # 岗位（zwxx）
        for row in await self._list("zwxx"):
            job = self._parse_zwxx(row)
            if job:
                jobs.append(job)
        # 宣讲会（xjh）
        for row in await self._list("xjh"):
            job = self._parse_fair(row, "xjh")
            if job:
                jobs.append(job)
        # 招聘会（zph）
        for row in await self._list("zph"):
            job = self._parse_fair(row, "zph")
            if job:
                jobs.append(job)
        return jobs

    def _parse_zwxx(self, r: dict) -> Job | None:
        jid = r.get("id_job") or r.get("id")
        name = (r.get("jobname") or "").strip()
        if not jid or not name:
            return None
        company = (r.get("companyname") or r.get("companyshort") or "").strip()
        city = (r.get("workplace") or "").strip()
        # 薪资（万元/年 常见口径，paymin=10 表示 10万/年）
        pay_min = self._num(r.get("paymin"))
        pay_max = self._num(r.get("paymax"))
        if pay_min or pay_max:
            salary_text = f"{pay_min:.0f}-{pay_max:.0f}万/年" if pay_min and pay_max else f"{pay_min or pay_max:.0f}万/年"
        else:
            salary_text = ""
        deadline = self._norm_date(r.get("enddate"))
        worktype = (r.get("worktype") or "").strip()
        degree = (r.get("xueli") or r.get("education") or "").strip()
        return Job(
            source=self.name,
            source_url=f"http://fjrclh.fzu.edu.cn/cms/zwxx/{jid}",
            external_id=f"zwxx_{jid}",
            title=name,
            company_name=company,
            city=city,
            job_type="intern" if "实习" in worktype else "campus",
            degree=degree,
            salary_min=pay_min,
            salary_max=pay_max,
            salary_text=salary_text,
            deadline_at=deadline,
            apply_url=f"http://fjrclh.fzu.edu.cn/cms/zwxx/{jid}",
            tags=[t for t in [worktype, (r.get("worktype") or "")] if t][:2],
        )

    def _parse_fair(self, r: dict, typedir: str) -> Job | None:
        fid = r.get("id") or r.get("id_zph") or r.get("id_xjh")
        name = (r.get("name") or r.get("company_name") or "").strip()
        if not fid or not name:
            return None
        start = r.get("starttime") or r.get("start_time") or ""
        place = r.get("place") or r.get("address") or ""
        return Job(
            source=self.name,
            source_url=f"http://fjrclh.fzu.edu.cn/cms/{typedir}/{fid}",
            external_id=f"{typedir}_{fid}",
            title=name,
            company_name="",
            city="",
            job_type="fair",
            posted_at=self._norm_date(start)[:10] if start else "",
            apply_url=f"http://fjrclh.fzu.edu.cn/cms/{typedir}/{fid}",
            tags=[p for p in [place] if p][:1],
        )

    @staticmethod
    def _num(v) -> float:
        try:
            f = float(v)
            return f if f > 0 else 0.0
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _norm_date(v) -> str:
        if not v:
            return ""
        s = str(v).strip()
        m = re.search(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})", s)
        if m:
            return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        return s[:10]
