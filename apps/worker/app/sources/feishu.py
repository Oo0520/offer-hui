# -*- coding: utf-8 -*-
"""飞书招聘系企业校招源（Playwright 拦截 API）。

通用：所有 {tenant}.jobs.feishu.cn 域名的企业都能用同一套逻辑。
反爬严格，httpx/curl_cffi 直接打 API 会 405/400，必须用浏览器拦截响应。
"""
import asyncio
import re
from datetime import datetime

import httpx
from playwright.async_api import async_playwright

from ..config import settings
from ..models import Job
from .base import BaseSource

# 区县 → 地级市映射
_DISTRICT_TO_CITY = {
    "闽侯县": "福州", "仓山区": "福州", "鼓楼区": "福州", "台江区": "福州",
    "晋安区": "福州", "马尾区": "福州", "长乐区": "福州", "福清市": "福州",
    "思明区": "厦门", "湖里区": "厦门", "集美区": "厦门", "海沧区": "厦门",
    "同安区": "厦门", "翔安区": "厦门",
    "丰泽区": "泉州", "鲤城区": "泉州", "洛江区": "泉州", "晋江市": "泉州",
    "石狮市": "泉州", "南安市": "泉州", "惠安县": "泉州",
    "荔城区": "莆田", "城厢区": "莆田", "涵江区": "莆田", "仙游县": "莆田",
    "芗城区": "漳州", "龙文区": "漳州", "龙海市": "漳州",
    "蕉城区": "宁德", "福安市": "宁德", "福鼎市": "宁德", "霞浦县": "宁德",
}


def _normalize_city(city: str) -> str:
    if not city:
        return ""
    c = city.strip()
    if c in _DISTRICT_TO_CITY:
        return _DISTRICT_TO_CITY[c]
    m = re.match(r"^(?:江苏|浙江|广东|福建|山东|河南|河北|湖北|湖南|四川|安徽|江西|陕西|辽宁|吉林|黑龙江)(.+)$", c)
    if m:
        c = m.group(1)
    c = re.sub(r"[市省]$", "", c)
    return c


class FeishuSource(BaseSource):
    """飞书招聘系单个企业源。每个 tenant 一个实例。"""

    def __init__(
        self,
        client: httpx.AsyncClient,
        tenant: str,
        company_name: str,
        industry: str,
        path: str = "/campus",
        max_pages: int = 15,
    ):
        super().__init__(client)
        self.tenant = tenant
        self.company_name = company_name
        self.industry = industry
        self.path = path
        self.max_pages = max_pages
        self.name = f"feishu_{tenant}"
        self.label = f"{company_name}官网"

    async def fetch(self) -> list[Job]:
        """用 Playwright 打开校招页，拦截 search/job/posts API 响应，翻页收集。"""
        jobs: list[Job] = []
        captured: asyncio.Queue = asyncio.Queue()
        seen_ids: set = set()

        async def on_response(resp):
            if "search/job/posts" in resp.url:
                try:
                    data = await resp.json()
                    await captured.put(data)
                except Exception:
                    pass

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=self.s.user_agent,
                viewport={"width": 1280, "height": 800},
            )
            page = await context.new_page()
            page.on("response", on_response)

            def collect():
                while not captured.empty():
                    data = captured.get_nowait()
                    for j in data.get("data", {}).get("job_post_list", []):
                        jid = j.get("id")
                        if jid and jid not in seen_ids:
                            seen_ids.add(jid)
                            jobs.append(self._parse(j))

            try:
                await page.goto(
                    f"https://{self.tenant}.jobs.feishu.cn{self.path}",
                    wait_until="domcontentloaded",
                    timeout=30000,
                )
                await page.wait_for_timeout(5000)
                collect()

                for pg in range(2, self.max_pages + 1):
                    try:
                        page_link = page.locator(f'div[class*="pager"] a:has-text("{pg}")')
                        if await page_link.count() > 0:
                            await page_link.first.click(timeout=5000)
                        else:
                            clicked = await page.evaluate(f"""() => {{
                                const links = document.querySelectorAll('div[class*=pager] a');
                                for (const a of links) {{
                                    if (a.textContent.trim() === '{pg}') {{ a.click(); return true; }}
                                }}
                                return false;
                            }}""")
                            if not clicked:
                                break
                        await page.wait_for_timeout(2500)
                        collect()
                    except Exception:
                        break
            except Exception as e:
                print(f"[{self.label}] 抓取错误: {e}")
            finally:
                page.remove_listener("response", on_response)
                await browser.close()

        return jobs

    def _parse(self, j: dict) -> Job:
        """解析飞书招聘岗位为 Job 对象。"""
        job_id = str(j.get("id", ""))
        title = j.get("title", "")
        city_list = j.get("city_list", []) or []
        city = _normalize_city(city_list[0].get("name", "") if city_list else "")
        recruit_type = (j.get("recruit_type") or {}).get("name", "")

        # 发布时间
        posted_at = ""
        if j.get("publish_time"):
            try:
                posted_at = datetime.fromtimestamp(j["publish_time"] / 1000).strftime("%Y-%m-%d")
            except Exception:
                pass

        # 招聘类型
        job_type = "intern" if "实习" in recruit_type else "campus"

        # 学历（从 requirement 提取）
        requirement = j.get("requirement", "") or ""
        degree = "学历不限"
        for deg in ["博士", "硕士", "本科", "大专", "专科"]:
            if deg in requirement:
                degree = deg
                break

        # 届别
        cohort = ""
        m = re.search(r"(20\d{2})届", title + requirement)
        if m:
            cohort = m.group(1) + "届"
        elif job_type == "campus":
            cohort = "2027届"  # 校招空届别补 2027

        apply_url = f"https://{self.tenant}.jobs.feishu.cn/campus/position/{job_id}/detail"

        return Job(
            source=self.name,
            source_url=apply_url,
            external_id=f"feishu_{self.tenant}_{job_id}",
            title=title,
            company_name=self.company_name,
            city=city,
            industry=self.industry,
            job_type=job_type,
            degree=degree,
            cohort=cohort,
            salary_text="",
            deadline_at=None,
            posted_at=posted_at,
            apply_url=apply_url,
            tags=[],
        )
