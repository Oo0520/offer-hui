"""fjrclh 增量爬虫（福建人才联合网，API 接口）
用法：python crawl-fjrclh.py
功能：抓 3 个板块（岗位/宣讲会/招聘会），分页抓全部，增量 upsert 写入 Supabase
v2（2026-09-27）：批量 upsert + content_hash 三分类（新增/变更/跳过）+ 批量过期标记
v3（2026-09-29）：city 归一化接入（normalize.normalize_city），标准数据 infra/classify/
v4（2026-09-30）：company_type 白名单修复 + 凭据改为 .env/环境变量（不再硬编码）
注意：content_hash 口径必须与 apps/worker/app/models.py 的 compute_hash 一致
"""
import re, os, json, time, hashlib, urllib.request, urllib.error, urllib.parse, httpx
from datetime import datetime, timezone
try:
    from normalize import normalize_city, normalize_company_by_name
except ImportError:
    def normalize_city(v):
        return (v or "").strip() or None
    def normalize_company_by_name(v):
        return None
# 邮件告警（crawl_alert.py；缺失时降级为打印，不影响主流程）
try:
    from crawl_alert import alert_crawl_failed
except ImportError:
    def alert_crawl_failed(script, err, stats=None):
        print(f"  ⚠ 告警模块缺失（crawl_alert.py），异常: {err}")


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
API = "http://fjrclh.fzu.edu.cn/CmsInterface/getCmsList"
BATCH_SIZE = 100
# 源站 WAF 会 403 掉 python-httpx 默认 UA（2026-09-27 实测），必须伪装浏览器
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

# jobs 表列白名单（发送前 sanitize，剔除 company 等内存键，防 PostgREST 未知列报错）
DB_COLS = ("source", "source_url", "external_id", "title", "company_id", "company_type", "job_type",
           "city", "province", "industry", "degree", "cohort", "salary_min", "salary_max",
           "salary_text", "deadline_at", "posted_at", "apply_url", "status", "tags",
           "content_hash")

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

def mark_expired_batch(eids: list):
    """一条批量 PATCH 标记过期"""
    if not eids:
        return
    in_list = ",".join(f'"{e}"' for e in eids)
    url = f"{BASE}/jobs?external_id=" + urllib.parse.quote(f"in.({in_list})")
    for attempt in range(2):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps({"status": "expired"}).encode(),
                headers={
                    "apikey": KEY,
                    "Authorization": f"Bearer {KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                method="PATCH"
            )
            urllib.request.urlopen(req, timeout=15)
            return
        except Exception as e:
            if attempt == 0:
                time.sleep(1)
            else:
                print(f"  批量过期标记失败: {e}")

def fetch_list_all(typedir: str, page_size: int = 100) -> list[dict]:
    """抓列表（API 只返回最新一批，不分页）"""
    try:
        resp = httpx.post(API, data={
            "typeid": "1",
            "typedir": typedir,
            "pageSize": str(page_size),
        }, headers={"Referer": "http://fjrclh.fzu.edu.cn/", "User-Agent": UA}, timeout=20)
        if resp.status_code != 200 or not resp.text.strip():
            return []
        data = resp.json()
    except Exception as e:
        print(f"  {typedir} 错误: {e}")
        return []
    if not data.get("success") and data.get("code") not in (0, "0", 200, "200"):
        print(f"  {typedir} 接口异常: {str(data)[:200]}")
        return []
    rows = data.get("list") or data.get("data") or data.get("result") or []
    if isinstance(rows, dict):
        rows = rows.get("list") or rows.get("records") or []
    return rows or []

def parse_job(r: dict) -> dict | None:
    """解析岗位"""
    jid = r.get("id_job") or r.get("id")
    name = (r.get("jobname") or "").strip()
    if not jid or not name:
        return None
    company = (r.get("companyname") or r.get("companyshort") or "").strip()
    city = (r.get("workplace") or "").strip()
    pay_min = float(r.get("paymin") or 0)
    pay_max = float(r.get("paymax") or 0)
    if pay_min or pay_max:
        salary_text = f"{pay_min:.0f}-{pay_max:.0f}万/年" if pay_min and pay_max else f"{pay_min or pay_max:.0f}万/年"
    else:
        salary_text = ""
    deadline = r.get("enddate") or ""
    worktype = (r.get("worktype") or "").strip()
    degree = (r.get("xueli") or r.get("education") or "").strip()
    return {
        "source": "fjrclh",
        "source_url": f"http://fjrclh.fzu.edu.cn/cms/zwxx/{jid}",
        "external_id": f"zwxx_{jid}",
        "title": name,
        "company": company,
        "company_id": None,
        "company_type": normalize_company_by_name(company),
        "job_type": "intern" if "实习" in worktype else "campus",
        "city": normalize_city(city),
        "salary_min": pay_min if pay_min > 0 else None,
        "salary_max": pay_max if pay_max > 0 else None,
        "salary_text": salary_text,
        "degree": degree or None,
        "deadline_at": normalize_date(deadline),
        "posted_at": None,
        "apply_url": f"http://fjrclh.fzu.edu.cn/cms/zwxx/{jid}",
        "tags": [worktype] if worktype else None,
        "status": "published",
    }

def parse_fair(r: dict, typedir: str) -> dict | None:
    """解析宣讲会/招聘会"""
    fid = r.get("id") or r.get("id_zph") or r.get("id_xjh")
    name = (r.get("name") or r.get("company_name") or "").strip()
    if not fid or not name:
        return None
    start = r.get("starttime") or r.get("start_time") or ""
    place = r.get("place") or r.get("address") or ""
    return {
        "source": "fjrclh",
        "source_url": f"http://fjrclh.fzu.edu.cn/cms/{typedir}/{fid}",
        "external_id": f"{typedir}_{fid}",
        "title": name,
        "company": "",
        "company_id": None,
        "job_type": "teachin" if typedir == "xjh" else "fair",
        "city": normalize_city(place),
        "degree": None,
        "posted_at": normalize_date(start),
        "apply_url": f"http://fjrclh.fzu.edu.cn/cms/{typedir}/{fid}",
        "tags": [place] if place else None,
        "status": "published",
    }

def normalize_date(v) -> str | None:
    if not v:
        return None
    s = str(v).strip()
    m = re.search(r"(\d{4})[/\-.]*(\d{1,2})[/\-.]*(\d{1,2})", s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return s[:10] if s else None

def is_expired(deadline: str | None) -> bool:
    """检查是否过期"""
    if not deadline:
        return False  # 没有截止日期就不过期
    try:
        d = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        return d < datetime.now(timezone.utc)
    except:
        return False

def classify(item: dict | None, existing: dict, pending: list, stats: dict, expiry_field: str):
    """三分类：新增 / 变更 / 跳过；过期行直接丢弃（由过期标记逻辑处理）"""
    if not item:
        return
    if is_expired(item.get(expiry_field)):
        return  # 沿用现状：本次列表中已过期的行不写入，不在列表才标过期
    eid = item["external_id"]
    h = compute_hash(item)
    if eid in existing and existing[eid] == h:
        stats["skipped"] += 1
        return
    item["content_hash"] = h
    pending.append(item)
    if eid in existing:
        stats["changed"] += 1
        print(f"  {eid} {item['title'][:30]} ↑")
    else:
        stats["new"] += 1
        print(f"  {eid} {item['title'][:30]} ✓")

# ========== 主流程 ==========
def main():
    print("=== fjrclh 增量爬虫（upsert 版） ===")
    stats = {"new": 0, "changed": 0, "skipped": 0, "fail": 0}

    try:
        # 1. 查已有 ID + hash
        print("\n[1/4] 查数据库已有数据...")
        existing = fetch_existing_map("fjrclh")
        print(f"  已有 {len(existing)} 条 published（含 hash {sum(1 for v in existing.values() if v)} 条）")

        # 2. 抓 3 个板块 + 三分类
        print("\n[2/4] 抓列表 + 三分类...")
        pending = []
        all_fetched_ids = set()
        # 记录每板块抓取结果：板块名 -> (是否抓取成功, 本次抓到的 external_id 集合)
        board_results = {}

        # 岗位
        print("\n--- 岗位 (zwxx) ---")
        rows = fetch_list_all("zwxx")
        print(f"  共 {len(rows)} 条")
        board_ids = set()
        for r in rows:
            eid = f"zwxx_{r.get('id_job') or r.get('id')}"
            board_ids.add(eid)
            all_fetched_ids.add(eid)
            classify(parse_job(r), existing, pending, stats, "deadline_at")
        board_results["zwxx"] = (len(rows) > 0, board_ids)

        # 宣讲会
        print("\n--- 宣讲会 (xjh) ---")
        rows = fetch_list_all("xjh")
        print(f"  共 {len(rows)} 条")
        board_ids = set()
        for r in rows:
            eid = f"xjh_{r.get('id') or r.get('id_xjh')}"
            board_ids.add(eid)
            all_fetched_ids.add(eid)
            classify(parse_fair(r, "xjh"), existing, pending, stats, "posted_at")
        board_results["xjh"] = (len(rows) > 0, board_ids)

        # 招聘会
        print("\n--- 招聘会 (zph) ---")
        rows = fetch_list_all("zph")
        print(f"  共 {len(rows)} 条")
        board_ids = set()
        for r in rows:
            eid = f"zph_{r.get('id') or r.get('id_zph')}"
            board_ids.add(eid)
            all_fetched_ids.add(eid)
            classify(parse_fair(r, "zph"), existing, pending, stats, "posted_at")
        board_results["zph"] = (len(rows) > 0, board_ids)

        # 3. 标记过期（安全版：仅当某板块本次抓取成功时，才把该板块不在最新列表里的存量标过期；
        #    抓取为空（接口失败）时跳过该板块，绝不误杀；existing 仅含 published，不会重复标记）
        print(f"\n[3/4] 标记过期（按板块，批量 PATCH，抓取为空则跳过）...")
        expired_count = 0
        for prefix, (ok, board_ids) in board_results.items():
            if not ok:
                print(f"  {prefix} 抓取为空，跳过过期标记（防止误杀）")
                continue
            board_existing = {e for e in existing if e.startswith(prefix + "_")}
            board_expired = board_existing - board_ids
            targets = list(board_expired)[:50]  # 每板块最多标记 50 条
            print(f"  {prefix} 过期 {len(targets)} 条")
            if targets:
                mark_expired_batch(targets)
            expired_count += len(targets)

        # 4. 分批写入
        print(f"\n[4/4] 写入 {len(pending)} 条（每批 {BATCH_SIZE}）...")
        for i in range(0, len(pending), BATCH_SIZE):
            flush(pending[i:i + BATCH_SIZE], stats)
            if i + BATCH_SIZE < len(pending):
                time.sleep(0.3)

        print(f"\n=== 完成 ===")
        print(f"新增: {stats['new']}, 变更: {stats['changed']}, 跳过: {stats['skipped']}, 过期: {expired_count}, 失败: {stats['fail']}")
        if stats["fail"] > 0:
            alert_crawl_failed("crawl-fjrclh.py", f"有 {stats['fail']} 条失败", stats)
    except Exception as e:
        import traceback
        alert_crawl_failed("crawl-fjrclh.py", f"{e}\n{traceback.format_exc()}", stats)
        raise

if __name__ == "__main__":
    main()
