# -*- coding: utf-8 -*-
"""北京大学就业网（scc.pku.edu.cn）。
该站列表数据由带 token 的 AJAX 加载；此处尝试解析列表页 HTML。
若站点改版或需要登录 token，抓取会返回空并记录 warning，不阻断其他源。
"""
import re

from ..models import Job
from .base import BaseSource


class PkuSource(BaseSource):
    name = "pku"
    label = "北京大学"

    BASE = "https://scc.pku.edu.cn"
    LIST_URL = "/frontpage/pku/html/recruitmentinfoList.html"

    async def fetch(self) -> list[Job]:
        jobs: list[Job] = []
        for typ in ("1", "2"):  # type=1 校招 / type=2 其他
            try:
                resp = await self._get(
                    f"{self.BASE}{self.LIST_URL}", params={"type": typ}
                )
                items = self._extract_items(resp.text)
                for title, href in items:
                    job = self._to_job(title, href, typ)
                    if job.title:
                        jobs.append(job)
            except Exception as e:
                print(f"[pku:type={typ}] 抓取失败: {type(e).__name__}: {e}")
        return jobs

    @staticmethod
    def _extract_items(html: str):
        """尽力从列表页 HTML 提取 (标题, 链接)。适配常见结构。"""
        items = []
        # 形如 <a href="...detail...">标题</a> 的条目
        for m in re.finditer(
            r'<a[^>]+href="([^"]+)"[^>]*>([^<>]{4,100})</a>', html
        ):
            href, title = m.group(1), m.group(2).strip()
            title = re.sub(r"\s+", " ", title)
            if not title:
                continue
            if ("detail" in href.lower() or "info" in href.lower()
                    or "/frontpage/" in href):
                items.append((title, href))
        # 去重保序
        seen = set()
        uniq = []
        for t, h in items:
            if h not in seen:
                seen.add(h)
                uniq.append((t, h))
        return uniq[:40]

    def _to_job(self, title: str, href: str, typ: str) -> Job:
        url = href if href.startswith("http") else f"{self.BASE}{href}"
        ext = re.sub(r"\W", "", href)[-32:]
        job = Job(
            source=self.name,
            source_url=url,
            external_id=ext or title[:32],
            title=title,
            company_name="",  # 北大列表需详情页补充
            city="北京",
            job_type="campus" if typ == "1" else "intern",
            apply_url=url,
        )
        job.content_hash = job.compute_hash()
        return job
