import asyncio
from playwright.async_api import async_playwright

async def t():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto('https://nio.jobs.feishu.cn/campus', wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_timeout(5000)
        btns = await page.evaluate("""() => {
            const all = document.querySelectorAll('button, a, [class*=page], [class*=more], [class*=load]');
            const result = [];
            for (const b of all) {
                const text = b.textContent.trim();
                if (text && text.length < 20 && (text.includes('更多') || text.includes('加载') || text.includes('下一页') || /^\\d+$/.test(text))) {
                    result.push({tag: b.tagName, text, class: b.className?.toString().slice(0,60)});
                }
            }
            return result.slice(0, 20);
        }""")
        print('分页按钮:', btns[:15])
        footer = await page.evaluate("() => document.body.innerText.slice(-500)")
        print('页面底部:', footer[:300])
        await browser.close()

asyncio.run(t())
