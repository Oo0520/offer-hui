"""jysd（91智慧就业）平台通用多学校爬虫（Scrapling，纯列表解析版）
用法：python crawl-jysd.py
功能：按 SCHOOLS 配置，逐校抓 5 个板块（全职/实习/宣讲会/招聘会/招聘公告），
      所有字段直接从列表卡片解析（无需逐个抓详情页），按日期过滤，
      增量 upsert / 过期标记，写入 Supabase
由来：由 crawl-fjut.py 通用化（2026-10-06）。jysd 平台高校站点结构一致，
      仅 host / domain 不同，新增学校只需在 SCHOOLS 加一行配置。
关键优化（2026-10-06）：列表卡片已含公司/行业/规模/标题/薪资/地点/学历/日期，
      不再抓详情页（StealthyFetcher 每次启动浏览器，抓详情页 10s+/个；
      纯列表解析每页 20 条，整体提速 10 倍以上）。
日期口径：
  - 全职/实习/公告（posted）：列表日期为发布日期，只保留近 max_age_days 天
  - 宣讲会/招聘会（event）：列表日期为举办时间，只保留未过期（>= 今天）
  - 存量 published 但本次有效集合中缺失的，批量标记 expired
兼容：fjut 源 external_id 沿用旧格式（job_/teachin_/jobfair_/campus_ 前缀）；
      其余学校 external_id 加 source 命名空间（如 jmu_job_123），避免跨校冲突。
注意：content_hash 口径必须与 apps/worker/app/models.py 的 compute_hash 一致
"""
from scrapling import StealthyFetcher
import re, os, json, time, hashlib, threading, urllib.request, urllib.error, urllib.parse, sys
from datetime import datetime, timedelta, timezone
try:
    from normalize import (normalize_city, normalize_industry, normalize_company_by_name,
                            normalize_company_type, normalize_province)
except ImportError:
    def normalize_city(v):
        return (v or "").strip() or None
    def normalize_industry(v):
        return None
    def normalize_company_by_name(v):
        return None
    def normalize_company_type(v):
        return None
    def normalize_province(v):
        return None

# 邮件告警：未捕获异常 → 发邮件（crawl_alert.py，静默失败不影响主流程）
try:
    from crawl_alert import alert_crawl_failed
except ImportError:
    def alert_crawl_failed(script, err, stats=None):
        print(f"  ⚠ 告警模块缺失（crawl_alert.py），异常: {err}")

SCRIPT_NAME = "crawl-jysd.py"
TZ = timezone(timedelta(hours=8))

def _excepthook(etype, evalue, tb):
    """全局异常钩子：先打印 traceback（保留默认行为，避免吞错），再发告警"""
    import traceback
    traceback.print_exception(etype, evalue, tb)
    alert_crawl_failed(SCRIPT_NAME, f"{etype.__name__}: {evalue}\n{traceback.format_exc()}")
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

BATCH_SIZE = 100

# jobs 表列白名单（发送前 sanitize，剔除 company 等内存键，防 PostgREST 未知列报错）
DB_COLS = ("source", "source_url", "external_id", "title", "company_id", "company_type", "job_type",
           "city", "province", "industry", "degree", "cohort", "salary_min", "salary_max",
           "salary_text", "deadline_at", "posted_at", "apply_url", "status", "tags",
           "content_hash")

# ========== 学校配置（新增学校在此加一行） ==========
# city：宣讲会/招聘会地点为校内教室时，兜底用学校所在城市
SCHOOLS = [
    {"source": "fjut", "host": "https://fjut.jysd.com", "domain": "fjut",
     "name": "福建理工大学", "city": "福州", "legacy_ids": True},
    {"source": "jmu", "host": "https://xsjyzd.jmu.edu.cn", "domain": "jmu",
     "name": "集美大学", "city": "厦门", "legacy_ids": False},
    {"source": "xmu", "host": "https://jy.xmu.edu.cn", "domain": "xmu",
     "name": "厦门大学", "city": "厦门", "legacy_ids": False},
]

# ========== 板块模板（URL 中 {host} / {domain} / {n} / {id} 占位） ==========
# date_type：posted=发布日期（按 max_age_days 窗口）；event=举办时间（保留未过期）
# card：卡片解析风格（jobcard=岗位卡片；list=信息列表）
# pages：翻页上限，posted 类型靠日期提前停止
SECTION_TEMPLATES = {
    "job": {
        "name": "全职岗位", "card": "jobcard",
        "list_url": "{host}/job/search/domain/{domain}/a/y/d_category/100/page/{n}",
        "detail_url": "{host}/job/view/id/{id}",
        "id_pattern": r'/job/view/id/(\d+)',
        "prefix": "job_",
        "pages": 80,
        "date_type": "posted",
        "max_age_days": 60,
    },
    "intern": {
        "name": "实习岗位", "card": "jobcard",
        "list_url": "{host}/job/search/domain/{domain}/a/y/d_category/102/page/{n}",
        "detail_url": "{host}/job/view/id/{id}",
        "id_pattern": r'/job/view/id/(\d+)',
        "prefix": "job_",
        "pages": 15,
        "date_type": "posted",
        "max_age_days": 60,
    },
    "teachin": {
        "name": "宣讲会", "card": "list",
        "list_url": "{host}/teachin",
        "detail_url": "{host}/teachin/view/id/{id}",
        "id_pattern": r'/teachin/view/id/(\d+)',
        "list_block": r'<ul class="infoList teachinList">(.*?)</ul>',
        "prefix": "teachin_",
        "pages": 5,
        "date_type": "event",
    },
    "fair": {
        "name": "招聘会", "card": "list",
        "list_url": "{host}/jobfair",
        "detail_url": "{host}/jobfair/view/id/{id}",
        "id_pattern": r'/jobfair/view/id/(\d+)',
        "list_block": r'<ul class="infoList jobfairList">(.*?)</ul>',
        "prefix": "jobfair_",
        "pages": 5,
        "date_type": "event",
    },
    "announcement": {
        "name": "招聘公告", "card": "list",
        "list_url": "{host}/campus/index/domain/{domain}/a/y/city//page/{n}",
        "detail_url": "{host}/campus/view/id/{id}",
        "id_pattern": r'/campus/view/id/(\d+)',
        "list_block": r'<ul class="infoList">(.*?)</ul>',
        "prefix": "campus_",
        "pages": 15,
        "date_type": "posted",
        "max_age_days": 60,
    },
}

def build_sections(school: dict) -> dict:
    """按学校实例化板块配置（填充 host/domain，保留 {n}/{id} 占位，应用学校级 pages 覆盖）"""
    out = {}
    override_pages = school.get("pages") or {}
    for key, tpl in SECTION_TEMPLATES.items():
        cfg = dict(tpl)
        # n="{n}"：保留页码占位给翻页时填充；id="{id}"：保留详情 id 占位
        cfg["list_url"] = tpl["list_url"].format(host=school["host"], domain=school["domain"], n="{n}")
        cfg["detail_url"] = tpl["detail_url"].format(host=school["host"], id="{id}")
        cfg["pages"] = override_pages.get(key, tpl["pages"])
        out[key] = cfg
    return out

def make_external_id(school: dict, cfg: dict, fid: str) -> str:
    """external_id：fjut 沿用旧格式；其余学校加 source 命名空间防跨校冲突"""
    if school.get("legacy_ids"):
        return f"{cfg['prefix']}{fid}"
    return f"{school['source']}_{cfg['prefix']}{fid}"

# ========== 字段解析辅助 ==========
def _strip_tags(s: str) -> str:
    return re.sub(r'<[^>]+>', '', s).strip()

def parse_salary(text):
    """薪资文本 → (min, max, text)；支持 9000-14000 / 8K-12K / 面议 / 日薪"""
    if not text:
        return None, None, None
    t = _strip_tags(text).strip()
    if not t or '面议' in t or '薪资' in t:
        return None, None, (t or None)
    def _val(v):
        v = v.strip()
        mult = 1000 if v.upper().endswith('K') else 1
        v = re.sub(r'[^\d.]', '', v)
        return float(v) * mult if v else None
    m = re.search(r'([\d.]+)\s*[Kk]?\s*[-~到至]\s*([\d.]+)\s*[Kk]?', t)
    if m:
        lo, hi = _val(m.group(1)), _val(m.group(2))
        if lo and hi:
            return int(lo), int(hi), t
    m = re.match(r'([\d.]+)\s*[Kk]?', t)
    if m:
        v = _val(m.group(1))
        if v:
            return int(v), int(v), t
    return None, None, t

def norm_degree(t):
    if not t:
        return None
    if '博士' in t: return '博士'
    if '硕士' in t or '研究生' in t: return '硕士'
    if '本科' in t: return '本科'
    if '大专' in t or '专科' in t: return '专科'
    if '不限' in t: return '不限'
    return None

def parse_event_time(text):
    """举办时间文本 → 开始时间 ISO（2026-10-08 18:00-21:00（周四）→ 18:00）"""
    if not text:
        return None
    m = re.search(r'(20\d{2}-\d{2}-\d{2})[ T](\d{2}):(\d{2})', text)
    if m:
        return f"{m.group(1)}T{m.group(2)}:{m.group(3)}:00+08:00"
    m = re.search(r'(20\d{2}-\d{2}-\d{2})', text)
    return f"{m.group(1)}T00:00:00+08:00" if m else None

def parse_posted_time(text):
    """发布日期文本 → ISO（2026-09-28发布 / 2026-09-18 13:29:32）"""
    if not text:
        return None
    m = re.search(r'(20\d{2}-\d{2}-\d{2})', text)
    if not m:
        return None
    hm = re.search(r'(\d{2}):(\d{2})(?::(\d{2}))?', text)
    if hm:
        return f"{m.group(1)}T{hm.group(1)}:{hm.group(2)}:00+08:00"
    return f"{m.group(1)}T00:00:00+08:00"

# ========== 卡片解析 ==========
def parse_jobcard(school, cfg, block):
    """岗位卡片（job/intern）：<li data-id="..."> 块"""
    m = re.search(r'<li data-id="(\d+)"', block)
    if not m:
        return None
    fid = m.group(1)
    company = None
    cm = re.search(r'/company/view/id/\d+"[^>]*>(.*?)</a>', block, re.DOTALL)
    if cm:
        company = _strip_tags(cm.group(1))
    # 公司行业/规模（company div 内两个 li）
    comp_meta = re.search(r'<div class="company">(.*?)</div>\s*<div class="name">', block, re.DOTALL)
    industry = None
    if comp_meta:
        lis = re.findall(r'<li[^>]*>(.*?)</li>', comp_meta.group(1), re.DOTALL)
        if lis:
            industry = normalize_industry(_strip_tags(lis[0]))
    # 标题
    title = None
    tm = re.search(rf'{re.escape(cfg["id_pattern"].replace(r"(\d+)", ""))}\d+"[^>]*title="([^"]+)"', block)
    if tm:
        title = tm.group(1)
    else:
        tm2 = re.search(r'title="([^"]+)"[^>]*target="_blank"', block)
        title = tm2.group(1) if tm2 else None
    # 发布日期（fjut 格式 "<span>2026-09-28发布</span>"；集美/厦大 "<span>2026-10-05</span>"）
    dm = re.search(r'<span>\s*(20\d{2}-\d{2}-\d{2})\s*(?:发布)?\s*</span>', block)
    posted = parse_posted_time(dm.group(0) if dm else None)
    # 薪资
    sm = re.search(r'<p class="text-orange"[^>]*>(.*?)</p>', block, re.DOTALL)
    sal_min, sal_max, sal_text = parse_salary(sm.group(1) if sm else None)
    # 地点/类型/学历（salary div 内 ul 的 li）
    sal_box = re.search(r'<div class="salary">(.*?)</div>', block, re.DOTALL)
    place = None
    degree = None
    if sal_box:
        lis = [_strip_tags(x) for x in re.findall(r'<li[^>]*>(.*?)</li>', sal_box.group(1), re.DOTALL)]
        if lis:
            place = lis[0]
        for x in lis:
            d = norm_degree(x)
            if d:
                degree = d
    city = normalize_city(place)
    return {
        "fid": fid,
        "company": company,
        "industry": industry,
        "title": title,
        "posted": posted,
        "sal_min": sal_min, "sal_max": sal_max, "sal_text": sal_text,
        "place": place, "city": city, "degree": degree,
    }

def parse_listcard(school, cfg, block):
    """信息列表（teachin/fair/announcement）：<ul class="infoList ..."> 块"""
    m = re.search(cfg["id_pattern"], block)
    if not m:
        return None
    fid = m.group(1)
    # 标题（优先 title 属性，否则链接文本）
    title = None
    tm = re.search(r'title="([^"]+)"', block)
    if tm:
        title = tm.group(1).strip()
    else:
        am = re.search(rf'{cfg["id_pattern"]}[^>]*>(.*?)</a>', block, re.DOTALL)
        if am:
            title = _strip_tags(am.group(1))
    # 地点（span 之外的 li）
    place = None
    pm = re.search(r'<li class="span\d+"[^>]*>(.*?)</li>', block, re.DOTALL)
    if pm:
        place = _strip_tags(pm.group(1))
    # 时间（最后一个 li）
    all_li = re.findall(r'<li[^>]*>(.*?)</li>', block, re.DOTALL)
    time_text = _strip_tags(all_li[-1]) if all_li else None
    if cfg["date_type"] == "event":
        event_iso = parse_event_time(time_text)
        posted = None
        # 校内教室归不到城市 → 兜底学校城市
        city = normalize_city(place) or school["city"]
    else:
        event_iso = None
        posted = parse_posted_time(time_text)
        city = normalize_city(place) or school["city"]
    return {
        "fid": fid,
        "company": title if cfg["date_type"] == "event" else None,
        "industry": None,
        "title": title,
        "posted": posted,
        "event_iso": event_iso,
        "sal_min": None, "sal_max": None, "sal_text": None,
        "place": place, "city": city, "degree": None,
    }

DETAIL_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# ── 浏览器可执行文件：优先用本机已装的 Chromium 内核浏览器，避免再下载 ~150MB ──
# 依据（2026-10-10 实读 site-packages）：
#   - scrapling 的 fetch() 接受 executable_path（_types.py 的 PlaywrightSession，
#     并在 _base.py 里把它传给浏览器启动参数）；
#   - patchright 驱动在给了 executable_path 时直接使用该二进制，且未见
#     "channel 与 executablePath 互斥" 的校验；
#   - ⚠️ 环境变量 SCRAPLING_EXECUTABLE_PATH **只被 scrapling 的 CLI/MCP 读取**
#     （cli.py / ai.py），直接调 StealthyFetcher.fetch() 不生效，必须显式传参。
# 找不到本机浏览器时返回空 dict，自动回退到 scrapling 自带的 Chromium。
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

# 详情页 <title> 里的站点级文案（无效 id / 错误页），不作为岗位标题
_DETAIL_TITLE_NOISE = ("就业创业服务平台", "智慧就业", "View Teachin", "View Fair", "View Campus")


def fetch_detail_title(url):
    """列表卡片没解析出标题时的回退：抓详情页的 <title> 与公司名。

    依据（2026-10-09 实测）：
      - jysd 的**列表页是 JS 渲染**的，静态 HTML 里没有任何卡片标记
        （零个 /job/view/id/、零个 title=、零个 infoList），所以列表卡片解析失败时
        无法从列表 HTML 补救；
      - 但**详情页是服务端渲染**的，纯 HTTP 可取、无需登录，且 <title> 就是岗位标题，
        公司名在 <a href="/company/view/id/NNN">公司名</a> 里。
    故这里用普通 HTTP（不是 StealthyFetcher，单页约 1s），且只对缺标题的卡片触发。
    """
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": DETAIL_UA, "Accept-Language": "zh-CN,zh;q=0.9"})
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read().decode("utf-8", "replace")
    except Exception as e:
        print(f"    ! 详情页回退失败 {url}: {str(e)[:80]}")
        return None, None
    tm = re.search(r"<title>(.*?)</title>", body, re.S)
    title = re.sub(r"\s+", " ", _strip_tags(tm.group(1))).strip() if tm else None
    if title and any(n in title for n in _DETAIL_TITLE_NOISE):
        title = None
    cm = re.search(r'<a href="/company/view/id/\d+">(.*?)</a>', body, re.S)
    company = re.sub(r"\s+", " ", _strip_tags(cm.group(1))).strip() if cm else None
    return (title or None), (company or None)


def build_item(school, section_key, cfg, parsed):
    """解析结果 → DB item（含 external_id/job_type/时间字段/公司性质）"""
    fid = parsed["fid"]
    eid = make_external_id(school, cfg, fid)
    url = cfg["detail_url"].format(id=fid)
    company = parsed.get("company")
    company_type = normalize_company_by_name(company)
    if not company_type:
        company_type = normalize_company_type(company)
    deadline_at = parsed.get("event_iso") if cfg["date_type"] == "event" else None
    return {
        "source": school["source"],
        "source_url": url,
        "external_id": eid,
        "title": parsed.get("title"),
        "company": company,
        "company_id": None,
        "company_type": company_type,
        "job_type": section_key,
        "city": parsed.get("city"),
        "province": normalize_province(parsed.get("city")),
        "industry": parsed.get("industry"),
        "degree": parsed.get("degree"),
        "salary_min": parsed.get("sal_min"),
        "salary_max": parsed.get("sal_max"),
        "salary_text": parsed.get("sal_text"),
        "deadline_at": deadline_at,
        "posted_at": parsed.get("posted"),
        "apply_url": url,
        "tags": [t for t in [parsed.get("place"), company] if t],
        "status": "published",
    }

# ========== 工具函数 ==========
def _rest_req(url, method="GET", data=None, extra_headers=None, retries=1):
    """REST 封装（GET/PATCH/POST），带 1 次重试"""
    last = None
    for attempt in range(retries + 1):
        try:
            headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
            if data is not None:
                headers["Content-Type"] = "application/json"
            if extra_headers:
                headers.update(extra_headers)
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            return urllib.request.urlopen(req, timeout=30).read()
        except Exception as e:
            last = e
            if attempt < retries:
                time.sleep(1)
    raise last

def _rest_get(url: str):
    return json.loads(_rest_req(url, retries=1))

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
    _rest_req(
        f"{BASE}/jobs?on_conflict=source,external_id",
        method="POST", data=json.dumps(items).encode(),
        extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"})


# 公司名 -> companies.id 缓存（跨学校、跨批复用，减少往返）
_COMPANY_IDS = {}

# 场馆/场地名**不是公司名**。教训（2026-10-10）：存量修复时把「学生活动中心117教室」
# 「福州大学土木工程学院1楼多功能厅」这类场地名 upsert 成了公司并挂到岗位上，
# 故对 tags 回退路径显式排除；卡片上 /company/view/id/ 解析出的公司名是权威的，不受此限。
_VENUE_RE = re.compile(r"教室|活动中心|多功能厅|报告厅|会议室|招聘大厅|宣讲厅|空中宣讲|线上|线下")


def resolve_company_ids(items: list, stats: dict):
    """把 item 里的公司名 upsert 进 companies 表，并回写 company_id。

    背景（2026-10-09 实测）：DB_COLS 白名单里只有 company_id（外键）、没有公司名列，
    sanitize() 会把 build_item 解析出的 company 字符串丢掉，
    导致这些源的卡片恒显示"官方发布"（jysd 三源 3454/3653 条缺公司）。
    companies 表有 name 唯一约束（on_conflict=name 实测可用），故 upsert 后取回 id。

    公司名来源优先级：
      1) parsed 的 company（卡片解析，或详情页回退补的）
      2) tags 最后一个元素 —— 历史数据里公司名就落在 tags
         （jmu/xmu: [place, company]；fjut: [company]）。
         **公告类不作为公司**：公告详情页没有 company 链接，本就没有公司概念。
    """
    names = []
    for it in items:
        nm = (it.get("company") or "").strip()
        if not nm and it.get("job_type") != "announcement":
            tags = [t for t in (it.get("tags") or []) if t]
            if tags:
                cand = str(tags[-1]).strip()
                # 场地名不是公司（宣讲会的 place 常常是教室），排除后再用
                if cand and not _VENUE_RE.search(cand):
                    nm = cand
                    it["company"] = nm
        if nm and nm not in _COMPANY_IDS and nm not in names:
            names.append(nm)

    for i in range(0, len(names), 200):
        batch = names[i:i + 200]
        try:
            body = _rest_req(
                f"{BASE}/companies?on_conflict=name",
                method="POST", data=json.dumps([{"name": n} for n in batch]).encode(),
                extra_headers={"Prefer": "resolution=merge-duplicates,return=representation"},
                retries=2)
            for row in json.loads(body):
                if row.get("name") and row.get("id"):
                    _COMPANY_IDS[row["name"]] = row["id"]
        except Exception as e:
            print(f"  ! 公司 upsert 失败（{len(batch)} 个）: {str(e)[:100]}")
            stats["company_fail"] = stats.get("company_fail", 0) + len(batch)

    hit = 0
    for it in items:
        cid = _COMPANY_IDS.get((it.get("company") or "").strip())
        if cid and it.get("company_id") != cid:
            it["company_id"] = cid
            hit += 1
    stats["company_linked"] = stats.get("company_linked", 0) + hit

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

def mark_expired(source: str, valid_eids: set, existing_map: dict, stats: dict):
    """存量 published 但不在本次有效集合 → 批量 PATCH status=expired（分批，每批 200）"""
    expired = [e for e in existing_map if e not in valid_eids]
    if not expired:
        return 0
    done = 0
    for i in range(0, len(expired), 200):
        batch = expired[i:i + 200]
        eid_in = ",".join(urllib.parse.quote(e) for e in batch)
        url = (f"{BASE}/jobs?source=eq.{source}&status=eq.published"
               f"&external_id=in.({eid_in})")
        try:
            _rest_req(url, method="PATCH", data=json.dumps({"status": "expired"}).encode())
            done += len(batch)
        except Exception as e:
            print(f"  标记过期批次失败 ✗ {e}")
    print(f"  标记过期 {done} 条 → expired")
    stats["expired"] = stats.get("expired", 0) + done
    return done

# ========== 单校流程 ==========
def crawl_school(school: dict, fetcher, total_stats: dict, today: datetime):
    source = school["source"]
    sections = build_sections(school)
    stats = {"new": 0, "changed": 0, "skipped": 0, "fail": 0, "expired": 0,
             "title_fallback": 0, "no_title": 0, "company_linked": 0, "company_fail": 0}
    print(f"\n{'='*60}")
    print(f"=== {school['name']}（source={source}）===")
    print(f"{'='*60}", flush=True)

    # 1. 查已有 ID + hash
    print("\n[1/3] 查数据库已有数据...")
    existing = fetch_existing_map(source)
    print(f"  已有 {len(existing)} 条 published（含 hash {sum(1 for v in existing.values() if v)} 条）")

    # 2. 逐板块抓列表 + 直接解析卡片（按日期过滤、跨板块去重）
    print("\n[2/3] 抓列表页 + 解析卡片（按日期过滤）...")
    items = []          # 待写入 item
    valid_eids = set()
    seen_eid = set()
    today_s = today.strftime("%Y-%m-%d")
    for section_key, cfg in sections.items():
        print(f"\n--- {cfg['name']} ---")
        cutoff = None
        if cfg["date_type"] == "posted":
            cutoff = (today - timedelta(days=cfg["max_age_days"])).strftime("%Y-%m-%d")
        kept = 0
        for n in range(1, cfg["pages"] + 1):
            url = cfg["list_url"].format(n=n)
            print(f"  抓列表 p{n}: {url}")
            page = fetcher.fetch(url, headless=True, network_idle=True, **_BROWSER_KW)
            h = page.body.decode("utf-8")
            # 按卡片风格切分
            if cfg["card"] == "jobcard":
                blocks = re.split(r'(?=<li data-id=")', h)
                blocks = [b for b in blocks if b.startswith('<li data-id=')]
            else:
                blocks = re.findall(cfg["list_block"], h, re.DOTALL)
            page_dates = []
            page_kept = 0
            for block in blocks:
                if cfg["card"] == "jobcard":
                    parsed = parse_jobcard(school, cfg, block)
                else:
                    parsed = parse_listcard(school, cfg, block)
                if not parsed:
                    continue
                # 日期过滤
                if cfg["date_type"] == "posted":
                    iso = parsed.get("posted")
                else:
                    iso = parsed.get("event_iso")
                d = iso[:10] if iso else None
                if d:
                    page_dates.append(d)
                    if cfg["date_type"] == "posted" and d < cutoff:
                        continue
                    if cfg["date_type"] == "event" and d < today_s:
                        continue
                item = build_item(school, section_key, cfg, parsed)
                eid = item["external_id"]
                # 回退触发条件（两种都算解析失败）：
                #   1) 标题为空 —— fjut 的卡片标题正则失配，实测 88% 的 fjut 行无标题
                #   2) 标题就是纯数字外部 id —— xmu/jmu 有 478 条公告把 id 写进了 title，
                #      真实标题落在 tags / 详情页（公告详情页 <title> 实测就是真实标题）
                raw_title = (item.get("title") or "").strip()
                if (not raw_title) or re.fullmatch(r"\d{3,}", raw_title):
                    dt, dc = fetch_detail_title(cfg["detail_url"].format(id=parsed["fid"]))
                    if dt:
                        item["title"] = dt
                        stats["title_fallback"] = stats.get("title_fallback", 0) + 1
                    if dc and not item.get("company"):
                        item["company"] = dc
                if not (item.get("title") or "").strip():
                    # 仍无标题：**不写库**（避免产生"没有信息"的残卡），但保留在 valid_eids，
                    # 以免把它判成过期而误藏掉可能是真岗位的记录。
                    stats["no_title"] = stats.get("no_title", 0) + 1
                    print(f"    ! 跳过无标题卡片 {eid}")
                    if eid in seen_eid:
                        continue
                    seen_eid.add(eid)
                    valid_eids.add(eid)
                    continue
                if eid in seen_eid:
                    continue
                seen_eid.add(eid)
                valid_eids.add(eid)
                items.append(item)
                page_kept += 1
            kept += page_kept
            print(f"    本页 {len(blocks)} → 保留 {page_kept}")
            if not blocks:
                break  # 空页到底
            if cfg["date_type"] == "posted" and page_dates and min(page_dates) < cutoff:
                break  # 已翻到窗口外
            time.sleep(1)
        print(f"  → {cfg['name']} 有效 {kept}")

    # 3. 标记过期 + 三分类 + 分批写入
    if valid_eids:
        print(f"\n[3/3] 标记过期（有效集合 {len(valid_eids)}）+ 三分类写入...")
        mark_expired(source, valid_eids, existing, stats)
    else:
        print("\n[3/3] 本次未抓到有效列表，跳过过期标记（防误标）")

    pending = []
    # 先把公司名落库并回写 company_id（此前 company 被白名单丢弃 → 卡片恒显示"官方发布"）
    if items:
        resolve_company_ids(items, stats)
    for item in items:
        eid = item["external_id"]
        h = compute_hash(item)
        if eid in existing and existing[eid] == h:
            stats["skipped"] += 1
            continue
        item["content_hash"] = h
        pending.append(item)
        if eid in existing:
            stats["changed"] += 1
        else:
            stats["new"] += 1
        if len(pending) >= BATCH_SIZE:
            flush(pending, stats)
            pending = []
    flush(pending, stats)

    print(f"\n--- {school['name']} 完成 ---")
    print(f"新增: {stats['new']}, 变更: {stats['changed']}, 跳过: {stats['skipped']}, "
          f"过期: {stats['expired']}, 失败: {stats['fail']}, "
        f"详情页补标题: {stats.get('title_fallback', 0)}, 无标题跳过: {stats.get('no_title', 0)}, "
        f"公司关联: {stats.get('company_linked', 0)}", flush=True)
    if stats["fail"] > 0:
        alert_crawl_failed(SCRIPT_NAME, f"{school['name']} 有 {stats['fail']} 条失败", stats)

    for k in ("new", "changed", "skipped", "fail", "title_fallback", "no_title",
              "company_linked", "company_fail"):
        total_stats[k] += stats[k]
    total_stats["expired"] = total_stats.get("expired", 0) + stats["expired"]
    return stats

# ========== 主流程 ==========
def main():
    today = datetime.now(TZ)
    print("=== jysd 通用多学校爬虫（纯列表解析版） ===")
    print(f"今天 {today.strftime('%Y-%m-%d')}，配置学校：{', '.join(s['name'] for s in SCHOOLS)}")
    total = {"new": 0, "changed": 0, "skipped": 0, "fail": 0, "expired": 0,
             "title_fallback": 0, "no_title": 0, "company_linked": 0, "company_fail": 0}

    try:
        fetcher = StealthyFetcher()  # 列表 fetcher 跨学校复用
        for school in SCHOOLS:
            crawl_school(school, fetcher, total, today)

        print(f"\n{'='*60}")
        print(f"=== 全部完成（{len(SCHOOLS)} 所学校）===")
        print(f"总计 新增: {total['new']}, 变更: {total['changed']}, 跳过: {total['skipped']}, "
              f"过期: {total['expired']}, 失败: {total['fail']}, "
      f"详情页补标题: {total.get('title_fallback', 0)}, 无标题跳过: {total.get('no_title', 0)}, "
      f"公司关联: {total.get('company_linked', 0)}")
        if total["fail"] > 0:
            alert_crawl_failed(SCRIPT_NAME, f"总计 {total['fail']} 条失败", total)
    except Exception as e:
        import traceback
        alert_crawl_failed(SCRIPT_NAME, f"{e}\n{traceback.format_exc()}", total)
        raise

if __name__ == "__main__":
    main()
