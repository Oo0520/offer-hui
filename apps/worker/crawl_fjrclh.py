"""fjrclh 增量爬虫（福建人才联合网，API 接口）
用法：python crawl_fjrclh.py
功能：抓 3 个板块（岗位/宣讲会/招聘会），增量写入 Supabase
环境变量：SUPABASE_SERVICE_KEY
"""
import re, os, json, urllib.request, httpx
from datetime import datetime, timezone

KEY = os.environ["SUPABASE_SERVICE_KEY"]
BASE = "https://sqmgjxazzpcfjutzscyu.supabase.co/rest/v1"
API = "http://fjrclh.fzu.edu.cn/CmsInterface/getCmsList"

def fetch_existing_ids():
    req = urllib.request.Request(
        f"{BASE}/jobs?select=external_id&source=eq.fjrclh",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    )
    rows = json.loads(urllib.request.urlopen(req, timeout=10).read())
    return {r["external_id"] for r in rows}

def fetch_list_all(typedir: str, page_size: int = 100) -> list[dict]:
    try:
        resp = httpx.post(API, data={
            "typeid": "1",
            "typedir": typedir,
            "pageSize": str(page_size),
        }, headers={"Referer": "http://fjrclh.fzu.edu.cn/"}, timeout=20)
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

def parse_job(r: dict):
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
        "company_id": None,
        "job_type": "intern" if "实习" in worktype else "campus",
        "city": city,
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

def parse_fair(r: dict, typedir: str):
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
        "company_id": None,
        "job_type": "teachin" if typedir == "xjh" else "fair",
        "city": None,
        "degree": None,
        "posted_at": normalize_date(start),
        "apply_url": f"http://fjrclh.fzu.edu.cn/cms/{typedir}/{fid}",
        "tags": [place] if place else None,
        "status": "published",
    }

def normalize_date(v):
    if not v:
        return None
    s = str(v).strip()
    m = re.search(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})", s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return s[:10] if s else None

def is_expired(deadline):
    if not deadline:
        return False
    try:
        d = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        return d < datetime.now(timezone.utc)
    except Exception:
        return False

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

print("=== fjrclh 增量爬虫 ===")
print("\n[1/4] 查数据库已有数据...")
existing = fetch_existing_ids()
print(f"  已有 {len(existing)} 条")

print("\n[2/4] 抓列表...")
all_new = []
all_fetched_ids = set()

print("\n--- 岗位 (zwxx) ---")
rows = fetch_list_all("zwxx")
print(f"  共 {len(rows)} 条")
new_jobs = [r for r in rows if f"zwxx_{r.get('id_job') or r.get('id')}" not in existing]
print(f"  新增 {len(new_jobs)} 个")
for r in new_jobs:
    item = parse_job(r)
    if item and not is_expired(item.get("deadline_at")):
        all_new.append(item)
    all_fetched_ids.add(item["external_id"] if item else f"zwxx_{r.get('id_job') or r.get('id')}")

print("\n--- 宣讲会 (xjh) ---")
rows = fetch_list_all("xjh")
print(f"  共 {len(rows)} 条")
new_xjh = [r for r in rows if f"xjh_{r.get('id') or r.get('id_xjh')}" not in existing]
print(f"  新增 {len(new_xjh)} 个")
for r in new_xjh:
    item = parse_fair(r, "xjh")
    if item and not is_expired(item.get("posted_at")):
        all_new.append(item)
    all_fetched_ids.add(item["external_id"] if item else f"xjh_{r.get('id') or r.get('id_xjh')}")

print("\n--- 招聘会 (zph) ---")
rows = fetch_list_all("zph")
print(f"  共 {len(rows)} 条")
new_zph = [r for r in rows if f"zph_{r.get('id') or r.get('id_zph')}" not in existing]
print(f"  新增 {len(new_zph)} 个")
for r in new_zph:
    item = parse_fair(r, "zph")
    if item and not is_expired(item.get("posted_at")):
        all_new.append(item)
    all_fetched_ids.add(item["external_id"] if item else f"zph_{r.get('id') or r.get('id_zph')}")

print(f"\n[3/4] 标记过期...")
expired = existing - all_fetched_ids
print(f"  过期 {len(expired)} 条")
for eid in list(expired)[:50]:
    try:
        req = urllib.request.Request(
            f"{BASE}/jobs?external_id=eq.{eid}",
            data=json.dumps({"status": "expired"}).encode(),
            headers={
                "apikey": KEY,
                "Authorization": f"Bearer {KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            method="PATCH"
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f"  {eid} 标记失败: {e}")

print(f"\n[4/4] 写入 {len(all_new)} 条...")
success = 0
for item in all_new:
    try:
        write_to_supabase(item)
        print(f"  {item['external_id']} {item['title'][:30]} OK")
        success += 1
    except Exception as e:
        print(f"  {item['external_id']} FAIL {e}")

print(f"\n=== 完成: 新增 {success}, 过期 {len(expired)} ===")
