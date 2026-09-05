# -*- coding: utf-8 -*-
"""哈尔滨工业大学就业网（job.hit.edu.cn）：POST JSON 接口。
关键字段：zpxxid(唯一ID) / zpxxmc(标题) / dwmc(单位) / fbsj(发布) /
         zpjsrq(招聘结束=截止日) / xlyq(学历) / gzdd(工作地点) / zplx(1实习/0就业)
"""
import json
import re

from ..models import Job
from .base import BaseSource


def _clean_city(raw: str) -> str:
    """去重地点顿号分隔：'上海市、上海市、上海' → '上海'。"""
    parts = [p.strip() for p in re.split(r"[、,，;；/]", raw or "") if p.strip()]
    seen, out = set(), []
    for p in parts:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return "、".join(out)


class HitSource(BaseSource):
    name = "hit"
    label = "哈尔滨工业大学"

    BASE = "https://job.hit.edu.cn"
    LIST_URL = "/zhxy-xszyfzpt/zpxx/getZpxxList"
    MAX_PAGES = 3  # MVP 控制抓取量

    async def fetch(self) -> list[Job]:
        jobs: list[Job] = []
        page = 1
        while page <= self.MAX_PAGES:
            param = {
                "zpxxmc": "", "dwmc": "", "xz": "", "dwxz": "", "dwhy": "",
                "sheng": "", "shi": "", "qu": "", "fbsj": "", "bkxlyq": "",
                "ssxlyq": "", "bsxlyq": "", "zplx": "", "dwgm": "",
                "sfcxcy": "", "sfwbqqy": "", "sfgzwssyq": "", "sfgfdw": "",
                "lm1": "", "lm2": "", "lm3": "", "lm4": "", "lm5": "", "lm6": "",
                "lx": 1,
                "page": page,
                "pageSize": self.s.max_items_per_source,
                "take": self.s.max_items_per_source,
                "skip": 0,
                "sort": "",
            }
            resp = await self._post(
                f"{self.BASE}{self.LIST_URL}?r=0.1",
                data={"info": json.dumps(param, ensure_ascii=False)},
                referer=f"{self.BASE}/zhxy-xszyfzpt/zpxx?xxfl=1&ztlx=",
            )
            payload = resp.json()
            if not payload.get("isSuccess"):
                break
            items = (payload.get("module") or {}).get("data") or []
            if not items:
                break
            for it in items:
                job = self._to_job(it)
                if job.title:
                    jobs.append(job)
            if len(items) < self.s.max_items_per_source:
                break
            page += 1
        return jobs

    def _to_job(self, it: dict) -> Job:
        zid = it.get("zpxxid", "")
        source_url = f"{self.BASE}/zhxy-xszyfzpt/zpxx/zpxxxq?id={zid}"
        job = Job(
            source=self.name,
            source_url=source_url,
            external_id=zid,
            title=it.get("zpxxmc", ""),
            company_name=it.get("dwmc", ""),
            city=_clean_city(it.get("gzdd", "")),
            industry=it.get("dwhy", ""),
            degree=it.get("xlyq", "") or "",
            posted_at=it.get("fbsj", ""),
            deadline_at=it.get("zpjsrq", ""),  # 截止日
            apply_url=source_url,  # 官方详情页（含投递入口）
            job_type="intern" if it.get("zplx") == "1" else "campus",
        )
        job.content_hash = job.compute_hash()
        return job
