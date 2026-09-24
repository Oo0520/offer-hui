"""fjut 全板块增量爬虫（Scrapling）
用法：python crawl_fjut.py
功能：抓 5 个板块（全职/实习/宣讲会/招聘会/招聘公告），增量写入 Supabase
环境变量：SUPABASE_SERVICE_KEY
"""
from scrapling import StealthyFetcher
import os, re, json, urllib.request, time

KEY = os.environ["SUPABASE_SERVICE_KEY"]
BASE = "https://sqmgjxazzpcfjutzscyu.supabase.co/rest/v1"

# ========== 配置 ==========
SECTIONS = {
    "job": {
        "name": "全职岗位",
        "list_url": "https://fjut.jysd.com/job/search/domain/fjut/a/y/d_category/100/page/{n}",
        "detail_url": "https://fjut.jysd.com/job/view/id/{id}",
        "id_pattern": r'/job/view/id/(\d+)',
        "prefix": "job_",
        "pages": 12,
    },
    "intern": {
        "name": "实习岗位",
        "list_url": "https://fjut.jysd.com/job/search/domain/fjut/a/y/d_category/102/page/{n}",
        "detail_url": "https://fjut.jysd.com/job/view/id/{id}",
        "id_pattern": r'/job/view/id/(\d+)',
        "prefix": "job_",
        "pages": 1,
    },
    "teachin": {
        "name": "宣讲会",
        "list_url": "https://fjut.jysd.com/teachin",
        "detail_url": "https://fjut.jysd.com/teachin/view/id/{id}",
        "id_pattern": r'/teachin/view/id/(\d+)',
        "prefix": "teachin_",
        "pages": 1,
    },
    "fair": {
        "name": "招聘会",
        "list_url": "https://fjut.jysd.com/jobfair",
        "detail_url": "https://fjut.jysd.com/jobfair/view/id/{id}",
        "id_pattern": r'/jobfair/view/id/(\d+)',
        "prefix": "jobfair_",
        "pages": 1,
    },
    "announcement": {
        "name": "招聘公告",
        "list_url": "https://fjut.jysd.com/campus/index/domain/fjut/a/y/city//page/{n}",
        "detail_url": "https://fjut.jysd.com/campus/view/id/{id}",
        "id_pattern": r'/campus/view/id/(\d+)',
        "prefix": "campus_",
        "pages": 3,
    },
}

# ========== 工具函数 ==========
def fetch_existing_ids():
    req = urllib.request.Request(
        f"{BASE}/jobs?select=external_id&source=eq.fjut",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    )
    rows = json.loads(urllib.request.urlopen(req, timeout=10).read())
    return {r["external_id"] for r in rows}

def fetch_list_ids(fetcher, section_key, cfg):
    ids = []
    for n in range(1, cfg["pages"] + 1):
        url = cfg["list_url"].format(n=n)
        print(f"  抓列表: {url}")
        page = fetcher.fetch(url, headless=True, network_idle=True)
        html = page.body.decode("utf-8")
        found = re.findall(cfg["id_pattern"], html)
        ids.extend(found)
        time.sleep(1)
    return list(dict.fromkeys(ids))

def parse_detail(fetcher, section_key, fid, cfg):
    url = cfg["detail_url"].format(id=fid)
    page = fetcher.fetch(url, headless=True, network_idle=True)
    h = page.body.decode("utf-8")

    title_m = re.search(r'class="details-title"[^>]*>(.*?)</', h)
    title = title_m.group(1).strip() if title_m else ""

    company_m = re.search(r'class="unit-info"[^>]*>.*?<a[^>]*>(.*?)</a>', h, re.DOTALL)
    company = company_m.group(1).strip() if company_m else None

    time_m = re.search(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})', h)
    start = time_m.group(1).replace(" ", "T") + ":00+08:00" if time_m else None

    place_m = re.search(r'(?:地点|地点：|举办地点)[：:]\s*(.*?)(?:<|$)', h)
    place = place_m.group(1).strip() if place_m else None

    salary_m = re.search(r'(\d+-\d+K|\d+K)', h)
    salary = salary_m.group(1) if salary_m else None

    degree_m = re.search(r'(本科|硕士|博士|专科|大专|学历不限)', h)
    degree = degree_m.group(1) if degree_m else None

    return {
        "source": "fjut",
        "source_url": url,
        "external_id": f"{cfg['prefix']}{fid}",
        "title": title,
        "company_id": None,
        "job_type": section_key,
        "city": place,
        "salary_text": salary,
        "degree": degree,
        "deadline_at": start,
        "posted_at": None,
        "apply_url": url,
        "tags": [t for t in [place, company] if t],
        "status": "published",
    }

def write_to_supabase(item):
    req = urllib.request.Request(
        f"{BASE}/jobs",
        data=json.dumps(item).encode(),
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        },
        method="POST"
    )
    urllib.request.urlopen(req, timeout=15)

# ========== 主流程 ==========
print("=== fjut 全板块增量爬虫 ===")
print("\n[1/4] 查数据库已有数据...")
existing = fetch_existing_ids()
print(f"  已有 {len(existing)} 条")

print("\n[2/4] 初始化 StealthyFetcher...")
fetcher = StealthyFetcher()

print("\n[3/4] 抓列表页...")
all_new = {}
for section_key, cfg in SECTIONS.items():
    print(f"\n--- {cfg['name']} ---")
    ids = fetch_list_ids(fetcher, section_key, cfg)
    print(f"  列表共 {len(ids)} 个")
    new_ids = [i for i in ids if f"{cfg['prefix']}{i}" not in existing]
    print(f"  新增 {len(new_ids)} 个")
    if new_ids:
        all_new[section_key] = new_ids

print("\n[4/4] 抓详情页 + 写入...")
total_success = 0
total_fail = 0
for section_key, ids in all_new.items():
    cfg = SECTIONS[section_key]
    print(f"\n--- {cfg['name']} ({len(ids)} 个) ---")
    for fid in ids:
        try:
            item = parse_detail(fetcher, section_key, fid, cfg)
            write_to_supabase(item)
            print(f"  {cfg['prefix']}{fid} {item['title'][:30]} OK")
            total_success += 1
        except Exception as e:
            print(f"  {cfg['prefix']}{fid} FAIL {e}")
            total_fail += 1
        time.sleep(0.5)

print(f"\n=== 完成: 成功 {total_success}, 失败 {total_fail} ===")
