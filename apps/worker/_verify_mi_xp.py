import asyncio
import json
from playwright.async_api import async_playwright

COMPANIES = [
    ("mi", "小米"),
    ("xiaopeng", "小鹏汽车"),
]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        for tenant, name in COMPANIES:
            print(f"\n=== {name} ({tenant}) ===")
            captured = []
            async def on_resp(resp):
                if "search/job/posts" in resp.url:
                    try:
                        captured.append(await resp.json())
                    except: pass
            page.on("response", on_resp)

            try:
                await page.goto(f"https://{tenant}.jobs.feishu.cn/campus", wait_until="domcontentloaded", timeout=20000)
                await page.wait_for_timeout(5000)
                title = await page.title()
                print(f"标题: {title}")

                if captured:
                    jobs = captured[0].get("data", {}).get("job_post_list", [])
                    total = captured[0].get("data", {}).get("count")
                    print(f"API 命中! 总数={total}, 本页={len(jobs)}")
                    if jobs:
                        j = jobs[0]
                        print(f"  示例: {j.get('title')} | city_list={j.get('city_list')}")
                        # 看有没有分页
                        pager = await page.evaluate("() => document.querySelector('[class*=pager]')?.textContent?.slice(0,50)")
                        print(f"  分页: {pager}")
                else:
                    # 看页面文本
                    text = await page.evaluate("() => document.body.innerText.slice(0, 300)")
                    print(f"无 API，页面文本: {text[:200]}")
                    # 看所有网络请求
                    reqs = await page.evaluate("() => performance.getEntriesByType('resource').map(r => r.name).filter(n => n.includes('api') || n.includes('job')).slice(0, 10)")
                    print(f"API 请求: {reqs}")
            except Exception as e:
                print(f"错误: {e}")

            page.remove_listener("response", on_resp)

        await browser.close()

asyncio.run(main())
