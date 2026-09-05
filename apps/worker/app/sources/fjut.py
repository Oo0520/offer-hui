# -*- coding: utf-8 -*-
"""福建理工大学 · 苍霞启航（jy.jysd.com 联盟站点）。

数据通道：
- 首页服务端渲染最新岗位 / 宣讲会 / 招聘会链接（无需登录）
- 岗位详情页 /job/view/id/{id} 公开可抓（联系方式需登录，跳过）
- 宣讲会 /teachin/view/id/{id}、招聘会 /jobfair/view/id/{id}
"""
import re

from curl_cffi.requests import AsyncSession

from ..models import Job
from .base import BaseSource


class FjutSource(BaseSource):
    name = "fjut"
    label = "福建理工大学就业网"
    home = "https://fjut.jysd.com/"

    # 首页板块链接正则
    _RE_JOB = re.compile(r"/job/view/id/(\d+)", re.I)
    _RE_TEACHIN = re.compile(r"/teachin/view/id/(\d+)", re.I)
    _RE_FAIR = re.compile(r"/jobfair/view/id/(\d+)", re.I)
    # 详情 li 字段行：职能类别：<span>xxx</span>
    _RE_LI = re.compile(r"<li[^>]*>([^<：]+)：<span[^>]*>(.*?)</span>", re.S)
    _RE_INFO = re.compile(r"<div class=\"info-left\">(.*?)</div>", re.S)

    async def _home(self):
        resp = await self._cc_get(self.home)
        return resp.text

    async def _detail(self, url: str):
        resp = await self._cc_get(url, referer=self.home)
        return resp.text

    async def _cc_get(self, url: str, referer: str | None = None):
        """jysd 站对 httpx/requests TLS 指纹拦截（403），必须走 curl_cffi 模拟 Chrome。
        注意：Referer 不当会触发 WAF（首页带同域 Referer 会被 403），默认不带。"""
        import asyncio

        await asyncio.sleep(self.s.request_delay)
        headers = {"User-Agent": self.s.user_agent}
        if referer:
            headers["Referer"] = referer
        async with AsyncSession(impersonate="chrome", timeout=25) as s:
            resp = await s.get(url, headers=headers)
            resp.raise_for_status()
            return resp

    async def fetch(self) -> list:
        jobs: list[Job] = []
        home = await self._home()

        job_ids = []
        for m in self._RE_JOB.finditer(home):
            if m.group(1) not in job_ids:
                job_ids.append(m.group(1))
        # 宣讲会/招聘会
        fair_items = []
        seen_fair = set()
        for m in list(self._RE_TEACHIN.finditer(home)) + list(self._RE_FAIR.finditer(home)):
            if m.group(1) not in seen_fair:
                seen_fair.add(m.group(1))
                fair_items.append(("teachin" if m.group(0).startswith("/teachin") else "jobfair", m.group(1)))

        for fid in job_ids[:8]:
            try:
                html = await self._detail(f"https://fjut.jysd.com/job/view/id/{fid}")
                job = self._parse_job(html, fid)
                if job:
                    jobs.append(job)
            except Exception as e:
                print(f"[fjut] 岗位 {fid} 解析失败: {e}")

        for kind, fid in fair_items[:6]:
            try:
                html = await self._detail(f"https://fjut.jysd.com/{kind}/view/id/{fid}")
                fair = self._parse_fair(html, kind, fid)
                if fair:
                    jobs.append(fair)
            except Exception as e:
                print(f"[fjut] {kind} {fid} 解析失败: {e}")

        return jobs

    def _parse_job(self, html: str, fid: str) -> Job | None:
        title_m = re.search(r"<div class=\"details-title\"[^>]*>\s*([^<]+?)\s*</div>", html) or re.search(r"<title>([^<]+)</title>", html)
        if not title_m:
            return None
        title = title_m.group(1).strip()
        if not title or title in ("职位详情", "岗位详情"):
            return None

        fields: dict[str, str] = {}
        for k, v in self._RE_LI.findall(html):
            fields[k.strip()] = re.sub(r"\s+", " ", v.strip())
        info = self._RE_INFO.search(html)
        info_text = re.sub(r"<[^>]+>", "|", info.group(1)) if info else ""
        info_parts = [p.strip() for p in info_text.split("|") if p.strip()]

        # info-left 形如：5000-7000 | 天津市武清区 | 全职 | 本科 | 2026-09-03 发布
        # 薪资需含区间符或 千/万 单位，避免把含数字的岗位名（如“【27届】”）误判
        salary_text = ""
        if info_parts and re.search(r"\d", info_parts[0]) and re.search(r"-|~|—|千|K|k|万", info_parts[0]):
            salary_text = info_parts[0]
        city = next((p for p in info_parts if "市" in p or "省" in p or "区" in p), "")
        job_nature = next((p for p in info_parts if p in ("全职", "兼职", "实习")), "")
        degree = next((p for p in info_parts if "学历" in p or "本科" in p or "硕士" in p or "博士" in p or "大专" in p), "")

        salary_min = salary_max = 0.0
        m = re.search(r"(\d+)(?:-|~|—)(\d+)", salary_text)
        if m:
            salary_min, salary_max = float(m.group(1)), float(m.group(2))
        elif re.search(r"(\d+)", salary_text):
            salary_min = float(re.search(r"(\d+)", salary_text).group(1))

        company = ""
        cm = re.search(
            r'<div class="unit-info">.*?<a href="/company/view/id/\d+">([^<]+)</a>', html, re.S
        )
        if cm:
            company = cm.group(1).strip()
        # 单位性质/行业/规模（用于 companies 元数据）
        comp_meta = {}
        for label in ("单位性质", "单位行业", "单位规模"):
            lm = re.search(rf"{label}：</label>\s*<span>([^<]+)</span>", html)
            if lm:
                comp_meta[label] = lm.group(1).strip()

        # 发布时间：页面内 “2026-09-03 发布”
        posted = ""
        pm = re.search(r"(\d{4}-\d{2}-\d{2})\s*发布", html)
        if pm:
            posted = pm.group(1)

        deadline = ""
        dm = re.search(r"截止[：:]?\s*(\d{4}-\d{2}-\d{2})", html)
        if dm:
            deadline = dm.group(1)

        # 岗位描述
        desc_m = re.search(r"<div class=\"details-mge\">(.*?)</div>", html, re.S)
        description = ""
        if desc_m:
            description = re.sub(r"<[^>]+>", " ", desc_m.group(1))
            description = re.sub(r"\s+", " ", description).strip()[:400]

        major = fields.get("需求专业", "")
        tags = [t for t in [job_nature, fields.get("职能类别", ""), major, fields.get("招聘人数", "")] if t][:4]
        if comp_meta:
            tags = (tags + [v for v in comp_meta.values() if v])[:5]
        return Job(
            source=self.name,
            source_url=f"https://fjut.jysd.com/job/view/id/{fid}",
            external_id=f"job_{fid}",
            title=title,
            company_name=company,
            city=city,
            job_type="intern" if job_nature == "实习" else "campus",
            degree=degree,
            salary_min=salary_min,
            salary_max=salary_max,
            salary_text=salary_text,
            deadline_at=deadline,
            posted_at=posted,
            apply_url=f"https://fjut.jysd.com/job/view/id/{fid}",
            tags=tags,
        )

    def _parse_fair(self, html: str, kind: str, fid: str) -> Job | None:
        title_m = re.search(r"<title>([^<]+)</title>", html)
        if not title_m:
            return None
        title = title_m.group(1).strip()
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text)
        # 时间与地点
        time_m = re.search(r"(\d{4}-\d{2}-\d{2}[^\s]{0,12}\d{2}:\d{2}[^\s]{0,20})", text) or re.search(
            r"(\d{4}-\d{2}-\d{2})", text)
        place_m = re.search(r"地点[：:]\s*([^ ]{2,40})", text)
        company = ""
        cm = re.search(r"单位名称[：:]\s*([^ ]{2,30})", text) or re.search(r"主办方[：:]\s*([^ ]{2,30})", text)
        if cm:
            company = cm.group(1)
        return Job(
            source=self.name,
            source_url=f"https://fjut.jysd.com/{kind}/view/id/{fid}",
            external_id=f"{kind}_{fid}",
            title=title,
            company_name=company,
            city="",
            job_type="fair",
            posted_at=time_m.group(1)[:10] if time_m else "",
            apply_url=f"https://fjut.jysd.com/{kind}/view/id/{fid}",
            tags=[place_m.group(1) if place_m else ""] if place_m else [],
        )
