import asyncio
from playwright.async_api import async_playwright

# 候选企业 tenant（飞书招聘域名格式：{tenant}.jobs.feishu.cn）
CANDIDATES = [
    ("lixiang", "理想汽车"), ("ideal", "理想汽车2"),
    ("xiaopeng", "小鹏汽车"), ("xpeng", "小鹏汽车2"),
    ("xiaomi", "小米"), ("mi", "小米2"),
    ("oppo", "OPPO"), ("vivo", "vivo"),
    ("haier", "海尔"), ("midea", "美的"),
    ("sany", "三一重工"), ("zoomlion", "中联重科"),
    ("byd", "比亚迪"), ("nio", "蔚来(已验证)"),
    ("ximalaya", "喜马拉雅"), ("zhihu", "知乎"),
    ("bilibili", "B站"), ("douban", "豆瓣"),
    ("meituan", "美团"), ("dianping", "大众点评"),
    ("jd", "京东"), ("alibaba", "阿里"),
    ("baidu", "百度"), ("netease", "网易"),
    ("ctrip", "携程"), ("qunar", "去哪儿"),
    ("weibo", "微博"), ("iqiyi", "爱奇艺"),
    ("youku", "优酷"), ("migu", "咪咕"),
    ("pingan", "平安"), ("cmb", "招行"),
    ("ccb", "建行"), ("icbc", "工行"),
]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 800, "height": 600},
        )
        page = await context.new_page()

        found = []
        for tenant, name in CANDIDATES:
            url = f"https://{tenant}.jobs.feishu.cn/campus"
            try:
                resp = await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(2000)
                title = await page.title()
                text = await page.evaluate("() => document.body.innerText.slice(0, 100)")
                # 判断是否是有效的招聘页
                is_valid = (
                    resp.status == 200
                    and ("招聘" in title or "职位" in title or "campus" in title.lower() or "feishu" in title.lower())
                    and "页面不存在" not in text
                    and "未找到" not in text
                )
                if is_valid:
                    # 看有没有岗位数据
                    has_jobs = "校招" in text or "实习" in text or "职位" in text
                    print(f"✓ {tenant} ({name}): {title[:40]} | has_jobs={has_jobs}")
                    found.append((tenant, name))
                else:
                    print(f"✗ {tenant} ({name}): {title[:30]} status={resp.status}")
            except Exception as e:
                print(f"✗ {tenant} ({name}): {str(e)[:50]}")

        await browser.close()
        print(f"\n找到 {len(found)} 家飞书招聘企业:")
        for t, n in found:
            print(f"  {t}: {n}")

asyncio.run(main())
