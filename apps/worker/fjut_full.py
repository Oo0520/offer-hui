# -*- coding: utf-8 -*-
"""fjut 福建理工大学就业网 · 全量列表采集（Playwright 渲染 + 登录态）

列表页 /job/search/d_category/{0|1} 的岗位数据依赖登录态 JS 渲染，
curl/普通请求拿不到，必须用真实浏览器内核 + 登录 cookie。
本脚本：
  1) 读取 fjut_cookies.txt（浏览器导出的登录 cookie）
  2) Playwright chromium 无头打开列表页，等 JS 渲染
  3) 解析 li[data-id] 条目（公司/行业/规模/岗位/薪资/城市/性质/学历/发布时间）
  4) 自动翻页到末页，全量入库（source=fjut, external_id=job_{id}，与首页源共用去重键）
  5) 增量：每日跑时旧 ID upsert 跳过，新 ID 入库

用法：python fjut_full.py [--dry] [--max-pages 30]
"""
import argparse
import json
import re
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

from playwright.sync_api import sync_playwright

from app.models import Job
from app.storage import PostgresStorage
from app.config import settings

BASE = "https://fjut.jysd.com"
COOKIE_FILE = Path(__file__).parent / "fjut_cookies.txt"

# 省名 → 去掉，取"市"
_RE_PROV = re.compile(r"^(?:北京市|天津市|上海市|重庆市|江苏省|浙江省|广东省|福建省|山东省|河南省|河北省|湖北省|湖南省|四川省|安徽省|江西省|陕西省|辽宁省|吉林省|黑龙江省|山西省|青海省|甘肃省|云南省|贵州省|海南省|台湾省|内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区|香港特别行政区|澳门特别行政区)")
_RE_CITY = re.compile(r"([\u4e00-\u9fa5]{2,8}市)")
_RE_COHORT = re.compile(r"(20\d{2})\s*届")


def _parse_cookie_file() -> list[dict]:
    """fjut_cookies.txt 每行 name=value"""
    text = COOKIE_FILE.read_text(encoding="utf-8").strip()
    out = []
    for pair in text.split(";"):
        pair = pair.strip()
        if not pair or "=" not in pair:
            continue
        name, value = pair.split("=", 1)
        out.append({
            "name": name.strip(),
            "value": value.strip(),
            "domain": "fjut.jysd.com",
            "path": "/",
        })
    return out


def _norm_city(raw: str) -> str:
    """江苏省常州市武进区 → 常州市；保留原始到 tags"""
    raw = raw.strip()
    if not raw:
        return ""
    m = _RE_CITY.search(_RE_PROV.sub("", raw))
    return m.group(1) if m else raw[:12]


def _parse_li(li, source_kind: str) -> Job | None:
    """从 li[data-id] 提取岗位字段"""
    jid = li.get_attribute("data-id")
    if not jid:
        return None
    title_el = li.query_selector(".name a")
    title = (title_el.get_attribute("title") or title_el.inner_text()).strip() if title_el else ""
    if not title or title in ("职位详情", "岗位详情"):
        return None

    comp_el = li.query_selector(".company a")
    company = comp_el.inner_text().strip() if comp_el else ""

    # 行业/规模
    industry, scale = "", ""
    comp_uls = li.query_selector_all(".company ul li")
    if len(comp_uls) >= 1:
        industry = comp_uls[0].inner_text().strip()
    if len(comp_uls) >= 2:
        scale = comp_uls[1].inner_text().strip()

    # 发布时间
    posted = ""
    span = li.query_selector(".name span")
    if span:
        m = re.search(r"(\d{4}-\d{2}-\d{2})", span.inner_text())
        if m:
            posted = m.group(1)

    # 薪资
    salary_text = ""
    sp = li.query_selector(".salary p")
    if sp:
        salary_text = sp.inner_text().strip()
    salary_min = salary_max = 0.0
    m = re.search(r"(\d+(?:\.\d+)?)\s*[-~—]\s*(\d+(?:\.\d+)?)", salary_text)
    if m:
        salary_min, salary_max = float(m.group(1)), float(m.group(2))
    elif re.search(r"(\d+(?:\.\d+)?)", salary_text):
        salary_min = float(re.search(r"(\d+(?:\.\d+)?)", salary_text).group(1))

    # 城市/工作性质/学历
    city, nature, degree = "", "", ""
    slis = li.query_selector_all(".salary ul li")
    if len(slis) >= 1:
        city = _norm_city(slis[0].inner_text().strip())
    if len(slis) >= 2:
        nature = slis[1].inner_text().strip()
    if len(slis) >= 3:
        degree = slis[2].inner_text().strip()

    tags = [t for t in [nature, industry, scale, city] if t][:5]
    cm = _RE_COHORT.search(title)
    cohort = f"{cm.group(1)}届" if cm else ""

    return Job(
        source="fjut",
        source_url=f"{BASE}/job/view/id/{jid}",
        external_id=f"job_{jid}",
        title=title,
        company_name=company,
        city=city,
        industry=industry,
        job_type="intern" if source_kind == "intern" else "campus",
        degree=degree,
        salary_min=salary_min,
        salary_max=salary_max,
        salary_text=salary_text,
        posted_at=posted,
        apply_url=f"{BASE}/job/view/id/{jid}",
        tags=tags,
        cohort=cohort,
    )


def crawl_list(context, kind: str, max_pages: int) -> list[Job]:
    """抓一个分类（全职/实习）的全部页"""
    dcat = "1" if kind == "intern" else "0"
    page = context.new_page()
    items: list[Job] = []
    seen_ids: set[str] = set()
    for pno in range(1, max_pages + 1):
        url = f"{BASE}/job/search/d_category/{dcat}/page/{pno}" if pno > 1 else f"{BASE}/job/search/d_category/{dcat}"
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            try:
                page.wait_for_selector("li[data-id]", timeout=20000)
            except Exception:
                time.sleep(2)
                if not page.query_selector("li[data-id]"):
                    # 可能无岗位：读页面提示判断是否空列表
                    body = page.inner_text("body")[:200]
                    if any(k in body for k in ("暂无", "没有", "无相关", "0条", "没有找到")):
                        print(f"  [fjut:{kind}] 第 {pno} 页无岗位（空列表），停止")
                        break
                    print(f"  [fjut:{kind}] 第 {pno} 页渲染超时: {body[:80]}")
                    break
            time.sleep(1.2)  # 等 JS 渲染稳定
        except Exception as e:
            print(f"  [fjut:{kind}] 第 {pno} 页加载失败: {e}")
            break

        lis = page.query_selector_all("li[data-id]")
        if not lis:
            print(f"  [fjut:{kind}] 第 {pno} 页无岗位，停止")
            break
        page_ids = [li.get_attribute("data-id") for li in lis]
        # 若本页全是已见 ID（翻到重复页）说明已到末页
        new_ids = [i for i in page_ids if i and i not in seen_ids]
        if not new_ids:
            print(f"  [fjut:{kind}] 第 {pno} 页无新岗位，末页")
            break
        seen_ids.update(new_ids)

        page_items = []
        for li in lis:
            try:
                job = _parse_li(li, kind)
                if job and job.external_id not in {x.external_id for x in items}:
                    page_items.append(job)
            except Exception as e:
                print(f"  [fjut:{kind}] 条目解析失败: {e}")
        items.extend(page_items)
        print(f"  [fjut:{kind}] 第 {pno} 页: {len(lis)} 条, 解析 {len(page_items)}, 累计 {len(items)}")
        if len(lis) < 20:
            print(f"  [fjut:{kind}] 不足 20 条，末页")
            break
    page.close()
    return items


def _upsert_retry(storage, job: Job) -> str:
    """Supabase pooler 长批量写入会断连，OperationalError 时重建连接重试"""
    import psycopg
    for attempt in range(3):
        try:
            return storage.upsert_job(job)
        except psycopg.OperationalError:
            if attempt == 2:
                raise
            print("  [fjut] 连接断开，重建后重试...")
            storage.conn.close()
            storage.conn = psycopg.connect(
                settings.database_url, autocommit=True, prepare_threshold=None
            )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true", help="只统计不写库")
    ap.add_argument("--max-pages", type=int, default=30)
    args = ap.parse_args()

    cookies = _parse_cookie_file()
    if not cookies:
        print("错误: fjut_cookies.txt 为空或不存在，请先从浏览器导出登录 cookie")
        sys.exit(1)
    print(f"cookie 载入 {len(cookies)} 项")

    storage = PostgresStorage(settings.database_url)
    stats = {"found": 0, "new": 0, "updated": 0, "skipped": 0}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            viewport={"width": 1366, "height": 900},
        )
        context.add_cookies(cookies)
        try:
            for kind in ("campus", "intern"):
                items = crawl_list(context, kind, args.max_pages)
                for job in items:
                    stats["found"] += 1
                    if args.dry:
                        continue
                    res = _upsert_retry(storage, job)
                    stats[res] += 1
                print(f"[fjut:{kind}] 共 {len(items)} 条")
        finally:
            context.close()
            browser.close()

    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
