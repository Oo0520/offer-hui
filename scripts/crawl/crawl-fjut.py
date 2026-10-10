"""fjut 全板块增量爬虫（Scrapling）
用法：python crawl-fjut.py
功能：抓 5 个板块（全职/实习/宣讲会/招聘会/招聘公告），增量 upsert 写入 Supabase
v2（2026-09-27）：批量 upsert + content_hash 三分类（新增/变更/跳过）
v3（2026-09-29）：详情页抓取并发化（线程池 5，每线程独立 StealthyFetcher），
                全量时长 1031s → 约 1/4；写入仍为批量 upsert，幂等不回归
v4（2026-09-29）：邮件告警（全局异常钩子 + 失败计数检查），见 crawl_alert.py
v5（2026-09-29）：city 归一化接入（normalize.normalize_city：英文/省市前缀/区县/场地地址 → 标准城市名），
                标准数据 infra/classify/（民政部 pcas.json + city_aliases.json）
v6（2026-09-30）：company_type 白名单修复 + 凭据改为 .env/环境变量（不再硬编码）
注意：content_hash 口径必须与 apps/worker/app/models.py 的 compute_hash 一致
"""
from scrapling import StealthyFetcher
import re, os, json, time, hashlib, threading, urllib.request, urllib.error, sys
import concurrent.futures
try:
    from normalize import normalize_city, normalize_company_by_name
except ImportError:
    def normalize_city(v):
        return (v or "").strip() or None
    def normalize_company_by_name(v):
        return None

# 邮件告警：未捕获异常 → 发邮件（crawl_alert.py，静默失败不影响主流程）
try:
    from crawl_alert import alert_crawl_failed
except ImportError:
    def alert_crawl_failed(script, err, stats=None):
        print(f"  ⚠ 告警模块缺失（crawl_alert.py），异常: {err}")

def _excepthook(etype, evalue, tb):
    """全局异常钩子：顶层未捕获异常时发告警"""
    import traceback
    alert_crawl_failed("crawl-fjut.py", f"{etype.__name__}: {evalue}\n{traceback.format_exc()}")
sys.excepthook = _excepthook

# 轻量 .env 加载（脚本同级；凭据不硬编码进 git，Secret Scanning 会拦截）
try:
    _envp = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.isfile(_envp):
        with open(_envp, "r", encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _v = _line.split("=", 1)
                    os.environ.setdefault(_k.strip(), _v.strip())
except Exception:
    pass

KEY = os.environ.get("SUPABASE_SERVICE_KEY")
if not KEY:
    raise SystemExit("缺少 SUPABASE_SERVICE_KEY 环境变量（从 .env 或环境注入，勿硬编码进 git）")
BASE = "https://sqmgjxazzpcfjutzscyu.supabase.co/rest/v1"

# 线程本地 fetcher：StealthyFetcher 非线程安全，每线程必须独立实例（2026-09-29 并发实测验证）
_tls = threading.local()

# ── 浏览器可执行文件：优先用本机已装的 Chromium 内核浏览器，避免再下载 ~150MB ──
# 依据（2026-10-10 实读 site-packages）：scrapling 的 fetch() 接受 executable_path；
# patchright 驱动在给了该参数时直接使用该二进制；⚠️ SCRAPLING_EXECUTABLE_PATH 环境变量
# 只被 scrapling 的 CLI/MCP 读取，直接调 StealthyFetcher.fetch() 不生效，必须显式传参。
_BROWSER_CANDIDATES = (
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
)


def _resolve_browser_kwargs() -> dict:
    exe = os.environ.get("OFFERHUI_BROWSER_EXE")
    if not exe or not os.path.exists(exe):
        exe = next((p for p in _BROWSER_CANDIDATES if os.path.exists(p)), None)
    if exe:
        print(f"  [browser] 使用本机浏览器: {exe}", flush=True)
        return {"executable_path": exe}
    print("  [browser] 未找到本机 Chromium 内核浏览器，回退到 scrapling 自带 Chromium", flush=True)
    return {}


_BROWSER_KW = _resolve_browser_kwargs()

def _thread_fetcher():
    if not hasattr(_tls, "fetcher"):
        _tls.fetcher = StealthyFetcher()
    return _tls.fetcher

BATCH_SIZE = 100

# jobs 表列白名单（发送前 sanitize，剔除 company 等内存键，防 PostgREST 未知列报错）
DB_COLS = ("source", "source_url", "external_id", "title", "company_id", "company_type", "job_type",
           "city", "province", "industry", "degree", "cohort", "salary_min", "salary_max",
           "salary_text", "deadline_at", "posted_at", "apply_url", "status", "tags",
           "content_hash")

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
def _rest_get(url: str, retries: int = 1):
    """GET 封装，带 1 次重试"""
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                url, headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
            return json.loads(urllib.request.urlopen(req, timeout=10).read())
        except Exception as e:
            last = e
            if attempt < retries:
                time.sleep(1)
    raise last

def fetch_existing_map(source: str) -> dict:
    """拉 {external_id: content_hash} 全量映射（仅 published；offset 分页防 1000 截断）"""
    existing = {}
    offset = 0
    while True:
        url = (f"{BASE}/jobs?select=external_id,content_hash&source=eq.{source}"
               f"&status=eq.published&offset={offset}&limit=1000")
        rows = _rest_get(url)
        for r in rows:
            existing[r["external_id"]] = r.get("content_hash")
        if len(rows) < 1000:
            return existing
        offset += 1000

def compute_hash(item: dict) -> str:
    """content_hash：SHA1 + sort_keys JSON，口径对齐 apps/worker/app/models.py"""
    payload = {
        "title": item.get("title") or "",
        "company": item.get("company") or "",
        "city": item.get("city") or "",
        "industry": item.get("industry") or "",
        "degree": item.get("degree") or "",
        "salary": [item.get("salary_min") or 0, item.get("salary_max") or 0],
        "salary_text": item.get("salary_text") or "",
        "deadline": item.get("deadline_at") or "",
        "apply": item.get("apply_url") or "",
        "tags": item.get("tags") or [],
    }
    norm = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha1(norm.encode("utf-8")).hexdigest()

def sanitize(item: dict) -> dict:
    """构造 DB payload：仅白名单列，剔除内存键；tags 为 NOT NULL 列，None 兜底 []"""
    payload = {k: item.get(k) for k in DB_COLS}
    if payload.get("tags") is None:
        payload["tags"] = []
    return payload

def upsert_batch(items: list):
    """批量 upsert：ON CONFLICT (source, external_id) DO UPDATE"""
    req = urllib.request.Request(
        f"{BASE}/jobs?on_conflict=source,external_id",
        data=json.dumps(items).encode(),
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal"
        },
        method="POST"
    )
    urllib.request.urlopen(req, timeout=30)

def flush(pending: list, stats: dict):
    """写一批：5xx/429/网络错退避重试 2 次，4xx 直接降级逐条；失败不中断（次日 hash 比对自愈）"""
    if not pending:
        return
    payload = [sanitize(it) for it in pending]
    for attempt in range(3):
        try:
            upsert_batch(payload)
            print(f"  批次写入 {len(payload)} 条 ✓")
            return
        except urllib.error.HTTPError as e:
            if e.code < 500 and e.code != 429:
                break  # 4xx 降级逐条定位坏行
            if attempt < 2:
                time.sleep(1 if attempt == 0 else 3)
        except Exception:
            if attempt < 2:
                time.sleep(1 if attempt == 0 else 3)
    for it in payload:  # 降级逐条
        try:
            upsert_batch([it])
        except Exception as e:
            print(f"  {it['external_id']} ✗ {e}")
            stats["fail"] += 1

def fetch_list_ids(fetcher, section_key, cfg):
    """抓列表页，提取所有 ID"""
    ids = []
    for n in range(1, cfg["pages"] + 1):
        url = cfg["list_url"].format(n=n)
        print(f"  抓列表: {url}")
        page = fetcher.fetch(url, headless=True, network_idle=True, **_BROWSER_KW)
        html = page.body.decode("utf-8")
        found = re.findall(cfg["id_pattern"], html)
        ids.extend(found)
        time.sleep(1)  # 礼貌延迟
    return list(dict.fromkeys(ids))  # 去重保序

def parse_detail(section_key, fid, cfg):
    """解析详情页（每线程独立 fetcher，并发安全）"""
    fetcher = _thread_fetcher()
    url = cfg["detail_url"].format(id=fid)
    page = fetcher.fetch(url, headless=True, network_idle=True, **_BROWSER_KW)
    h = page.body.decode("utf-8")
    # 关键：剥离内联 base64（图片/统计像素），否则其中的随机"数字K"会让 salary_text
    # 每次抓取都不同 → content_hash 全量抖动 → 增量分类失效（2026-09-28 诊断实锤）
    h = re.sub(r"[A-Za-z0-9+/=]{200,}", "", h)

    # 标题
    title_m = re.search(r'class="details-title"[^>]*>(.*?)</', h)
    title = title_m.group(1).strip() if title_m else ""

    # 公司
    company_m = re.search(r'class="unit-info"[^>]*>.*?<a[^>]*>(.*?)</a>', h, re.DOTALL)
    company = company_m.group(1).strip() if company_m else None

    # 时间
    time_m = re.search(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})', h)
    start = time_m.group(1).replace(" ", "T") + ":00+08:00" if time_m else None

    # 地点
    place_m = re.search(r'(?:地点|地点：|举办地点)[：:]\s*(.*?)(?:<|$)', h)
    place = place_m.group(1).strip() if place_m else None

    # 薪资：jysd 页面无结构化薪资区。全页搜「数字K」只会命中 base64/渲染数据碎片
    # （2026-09-28 诊断：348 条中 14 条 salary_text 全为 '9K'/'0K'/'39K' 类碎片，无一真实），
    # 且碎片值每次渲染都变 → hash 抖动。fjut 源 salary_text 恒 None（fjrclh 为 API 结构化数据，不受影响）
    salary = None

    # 学历
    degree_m = re.search(r'(本科|硕士|博士|专科|大专|学历不限)', h)
    degree = degree_m.group(1) if degree_m else None

    return {
        "source": "fjut",
        "source_url": url,
        "external_id": f"{cfg['prefix']}{fid}",
        "title": title,
        "company": company,
        "company_id": None,
        "company_type": normalize_company_by_name(company),
        "job_type": section_key,
        "city": normalize_city(place),
        "salary_text": salary,
        "degree": degree,
        "deadline_at": start,
        "posted_at": None,
        "apply_url": url,
        "tags": [t for t in [place, company] if t],
        "status": "published",
    }

# ========== 主流程 ==========
def main():
    print("=== fjut 全板块增量爬虫（upsert 版） ===")
    stats = {"new": 0, "changed": 0, "skipped": 0, "fail": 0}

    try:
        # 1. 查已有 ID + hash
        print("\n[1/4] 查数据库已有数据...")
        existing = fetch_existing_map("fjut")
        print(f"  已有 {len(existing)} 条 published（含 hash {sum(1 for v in existing.values() if v)} 条）")

        # 2. 初始化 fetcher
        print("\n[2/4] 初始化 StealthyFetcher...")
        fetcher = StealthyFetcher()

        # 3. 抓列表 + 全局去重（job 与 intern 板块 prefix 同为 job_，同 id 会产生重复 external_id，
        #    批量 upsert 下同批同键会冲突，必须前置去重；首个板块先入）
        print("\n[3/4] 抓列表页...")
        all_check = []  # [(section_key, fid, cfg)]
        seen_eid = set()
        for section_key, cfg in SECTIONS.items():
            print(f"\n--- {cfg['name']} ---")
            ids = fetch_list_ids(fetcher, section_key, cfg)
            new_cnt = exist_cnt = dup = 0
            for fid in ids:
                eid = f"{cfg['prefix']}{fid}"
                if eid in seen_eid:
                    dup += 1
                    continue
                seen_eid.add(eid)
                if eid in existing:
                    exist_cnt += 1
                else:
                    new_cnt += 1
                all_check.append((section_key, fid, cfg))
            extra = f"（跨板块去重 {dup}）" if dup else ""
            print(f"  列表共 {len(ids)} → 待检 {exist_cnt + new_cnt}（新增 {new_cnt} / 存量 {exist_cnt}）{extra}")

        # 4. 抓详情 + 三分类 + 分批写入（线程池 5 并发抓详情页）
        print(f"\n[4/4] 抓详情页 + 三分类 + 写入（待检 {len(all_check)}，线程池 5，每批 {BATCH_SIZE}）...")
        pending = []

        def _classify(item, eid):
            """三分类：返回 (is_skip, is_new)；跳过静默不刷屏"""
            h = compute_hash(item)
            if eid in existing and existing[eid] == h:
                return True, False
            item["content_hash"] = h
            return False, eid not in existing

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
            futures = {ex.submit(parse_detail, sk, fid, cfg): f"{cfg['prefix']}{fid}"
                       for sk, fid, cfg in all_check}
            for fut in concurrent.futures.as_completed(futures):
                eid = futures[fut]
                try:
                    item = fut.result()
                except Exception as e:
                    print(f"  {eid} ✗ 解析失败 {e}")
                    stats["fail"] += 1
                    continue
                is_skip, is_new = _classify(item, eid)
                if is_skip:
                    stats["skipped"] += 1
                else:
                    pending.append(item)
                    if is_new:
                        stats["new"] += 1
                    else:
                        stats["changed"] += 1
                    print(f"  {eid} {item['title'][:30]} {'✓' if is_new else '↑'}")
                    if len(pending) >= BATCH_SIZE:
                        flush(pending, stats)
                        pending = []
        flush(pending, stats)

        print(f"\n=== 完成 ===")
        print(f"新增: {stats['new']}, 变更: {stats['changed']}, 跳过: {stats['skipped']}, 失败: {stats['fail']}")
        if stats["fail"] > 0:
            alert_crawl_failed("crawl-fjut.py", f"有 {stats['fail']} 条失败", stats)
    except Exception as e:
        import traceback
        alert_crawl_failed("crawl-fjut.py", f"{e}\n{traceback.format_exc()}", stats)
        raise

if __name__ == "__main__":
    main()
