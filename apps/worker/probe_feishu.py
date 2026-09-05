"""飞书招聘系企业校招爬虫（Playwright）
通用：所有 {tenant}.jobs.feishu.cn 域名的企业都能用同一套逻辑
"""
import asyncio
import json
import re
from datetime import datetime
from playwright.async_api import async_playwright


# 区县 → 地级市映射
DISTRICT_TO_CITY = {
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


def normalize_city(city: str) -> str:
    if not city:
        return ""
    c = city.strip()
    if c in DISTRICT_TO_CITY:
        return DISTRICT_TO_CITY[c]
    m = re.match(r"^(?:江苏|浙江|广东|福建|山东|河南|河北|湖北|湖南|四川|安徽|江西|陕西|辽宁|吉林|黑龙江)(.+)$", c)
    if m:
        c = m.group(1)
    c = re.sub(r"[市省]$", "", c)
    return c


# 已验证的飞书招聘企业 tenant
FEISHU_COMPANIES = [
    {"tenant": "nio", "name": "蔚来", "industry": "新能源汽车", "path": "/campus"},
    {"tenant": "mi", "name": "小米", "industry": "消费电子/智能硬件", "path": "/campus"},
    {"tenant": "xiaopeng", "name": "小鹏汽车", "industry": "新能源汽车", "path": "/campus/position/list"},
]

# 待验证的 tenant（先注释，验证后启用）
# {"tenant": "lixiang", "name": "理想汽车", "industry": "新能源汽车"},
# {"tenant": "xiaopeng", "name": "小鹏汽车", "industry": "新能源汽车"},


async def fetch_company(page, company, max_pages=15):
    """打开企业校招页，点击分页翻页，拦截 API 响应拿岗位数据"""
    jobs = []
    captured = asyncio.Queue()
    seen_ids = set()

    async def on_response(resp):
        if "search/job/posts" in resp.url:
            try:
                data = await resp.json()
                await captured.put(data)
            except Exception:
                pass

    page.on("response", on_response)

    def collect():
        nonlocal jobs
        while not captured.empty():
            data = captured.get_nowait()
            job_list = data.get("data", {}).get("job_post_list", [])
            for j in job_list:
                jid = j.get("id")
                if jid and jid not in seen_ids:
                    seen_ids.add(jid)
                    jobs.append(j)

    try:
        await page.goto(f"https://{company['tenant']}.jobs.feishu.cn{company.get('path', '/campus')}",
                        wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(5000)
        collect()

        # 点击页码翻页
        for p in range(2, max_pages + 1):
            try:
                # 找页码链接
                page_link = page.locator(f'div[class*="pager"] a:has-text("{p}")')
                if await page_link.count() > 0:
                    await page_link.first.click(timeout=5000)
                    await page.wait_for_timeout(2500)
                    collect()
                else:
                    # 尝试用 evaluate 点击
                    clicked = await page.evaluate(f"""() => {{
                        const links = document.querySelectorAll('div[class*=pager] a');
                        for (const a of links) {{
                            if (a.textContent.trim() === '{p}') {{ a.click(); return true; }}
                        }}
                        return false;
                    }}""")
                    if clicked:
                        await page.wait_for_timeout(2500)
                        collect()
                    else:
                        print(f"  第 {p} 页未找到，停止翻页")
                        break
            except Exception as e:
                print(f"  第 {p} 页错误: {e}")
                break

    except Exception as e:
        print(f"  [{company['name']}] 错误: {e}")

    page.remove_listener("response", on_response)
    return jobs


def parse_job(j, company):
    """解析飞书招聘岗位为统一格式"""
    job_id = str(j.get("id", ""))
    title = j.get("title", "")
    city_list = j.get("city_list", []) or []
    city = city_list[0].get("name", "") if city_list else ""
    recruit_type = (j.get("recruit_type") or {}).get("name", "")
    job_function = (j.get("job_function") or {}).get("name", "")
    job_subject = (j.get("job_subject") or {}).get("name", {})
    if isinstance(job_subject, dict):
        job_subject = job_subject.get("zh_cn", "") or job_subject.get("name", "")
    code = j.get("code", "")

    # 发布时间
    publish_ts = j.get("publish_time")
    posted_at = ""
    if publish_ts:
        try:
            posted_at = datetime.fromtimestamp(publish_ts / 1000).strftime("%Y-%m-%d")
        except Exception:
            pass

    # 招聘类型映射
    job_type = "campus"
    if "实习" in recruit_type:
        job_type = "intern"

    # 学历要求（从 requirement 里提取）
    requirement = j.get("requirement", "") or ""
    degree = "学历不限"
    for deg in ["博士", "硕士", "本科", "大专", "专科"]:
        if deg in requirement:
            degree = deg
            break

    # 届别（从 requirement 或 title 里提取）
    cohort = ""
    m = re.search(r"(20\d{2})届", title + requirement)
    if m:
        cohort = m.group(1) + "届"

    # 投递链接：具体岗位详情页
    apply_url = f"https://{company['tenant']}.jobs.feishu.cn/campus/position/{job_id}/detail"
    source_url = apply_url

    # 城市归一化
    city = normalize_city(city)

    # 届别补全：校招岗位空 cohort → 2027届
    if not cohort and job_type == "campus":
        cohort = "2027届"

    # 行业补全
    industry = company.get("industry", "未分类") or "未分类"

    return {
        "title": title,
        "company_name": company["name"],
        "city": city,
        "industry": industry,
        "job_type": job_type,
        "degree": degree,
        "cohort": cohort,
        "salary_text": "",
        "deadline_at": None,
        "posted_at": posted_at,
        "apply_url": apply_url,
        "source_url": source_url,
        "external_id": f"feishu_{company['tenant']}_{job_id}",
        "source": f"feishu_{company['tenant']}",
        "raw_recruit_type": recruit_type,
        "raw_job_function": job_function,
        "raw_job_subject": str(job_subject),
        "raw_code": code,
    }


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        all_jobs = []
        for company in FEISHU_COMPANIES:
            print(f"抓取 {company['name']} ({company['tenant']})...")
            raw = await fetch_company(page, company, max_pages=20)
            print(f"  原始岗位: {len(raw)}")
            parsed = [parse_job(j, company) for j in raw]
            print(f"  解析后: {len(parsed)}")
            if parsed:
                print(f"  示例: {parsed[0]['title']} | {parsed[0]['city']} | {parsed[0]['degree']} | {parsed[0]['cohort']}")
                print(f"        {parsed[0]['apply_url']}")
            all_jobs.extend(parsed)

        await browser.close()

        with open("_feishu_jobs.json", "w", encoding="utf-8") as f:
            json.dump(all_jobs, f, ensure_ascii=False, indent=2)
        print(f"\n总计: {len(all_jobs)} 条，已保存到 _feishu_jobs.json")


if __name__ == "__main__":
    asyncio.run(main())
