import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        captured = []
        async def on_resp(resp):
            if "search/job/posts" in resp.url:
                try:
                    captured.append(await resp.json())
                except: pass
        page.on("response", on_resp)

        await page.goto("https://xiaopeng.jobs.feishu.cn/campus", wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(3000)
        print("当前 URL:", page.url)

        # 点击"职位"
        try:
            pos_link = page.get_by_text("职位", exact=True)
            if await pos_link.count() > 0:
                await pos_link.first.click(timeout=5000)
                await page.wait_for_timeout(4000)
                print("点击后 URL:", page.url)
        except Exception as e:
            print("点击职位失败:", e)

        # 看有没有 API
        if captured:
            jobs = captured[0].get("data", {}).get("job_post_list", [])
            print(f"API 命中! 总数={captured[0].get('data',{}).get('count')}, 本页={len(jobs)}")
            if jobs:
                print(f"  示例: {jobs[0].get('title')}")
        else:
            print("无 API，页面文本:", (await page.evaluate("() => document.body.innerText.slice(0,200)")))

        # 看分页
        pager = await page.evaluate("() => document.querySelector('[class*=pager]')?.textContent?.slice(0,50)")
        print(f"分页: {pager}")

        await browser.close()

asyncio.run(main())
