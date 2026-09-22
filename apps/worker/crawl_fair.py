"""抓 fjut.jysd.com 招聘会，只保留未过期的"""
import urllib.request, json, re, os
from datetime import datetime
from bs4 import BeautifulSoup

KEY = os.environ.get("SUPABASE_SERVICE_KEY")
BASE = "https://sqmgjxazzpcfjutzscyu.supabase.co/rest/v1"
TODAY = datetime(2026, 9, 22)

URL = "https://fjut.jysd.com/jobfair"
req = urllib.request.Request(URL, headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
})
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="ignore")
soup = BeautifulSoup(html, "html.parser")

# 找所有 jobfair/view/id 链接
links = soup.find_all("a", href=re.compile(r"/jobfair/view/id/\d+"))
print(f"找到 {len(links)} 个链接")

valid = []
seen = set()
for a in links:
    href = a["href"]
    fid = re.search(r"/id/(\d+)", href).group(1)
    if fid in seen:
        continue
    seen.add(fid)
    name = a.get_text(strip=True)
    # 找所在行的其他列
    tr = a.find_parent("tr")
    if not tr:
        continue
    tds = tr.find_all("td")
    if len(tds) < 3:
        continue
    place = tds[1].get_text(strip=True)
    time_str = tds[2].get_text(strip=True)
    # 解析日期
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", time_str)
    if not m:
        continue
    dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    if dt < TODAY:
        continue
    detail_url = f"https://fjut.jysd.com{href}"
    valid.append({
        "title": name,
        "source": "fjut",
        "source_url": detail_url,
        "external_id": f"jobfair_{fid}",
        "job_type": "fair",
        "city": "福州",
        "apply_url": detail_url,
        "deadline_at": dt.strftime("%Y-%m-%d"),
        "posted_at": dt.strftime("%Y-%m-%d"),
        "status": "published",
        "is_intern": False,
    })
    print(f"  有效: {name[:40]} | {time_str[:30]}")

print(f"\n有效招聘会: {len(valid)} 条")

for job in valid:
    req = urllib.request.Request(f"{BASE}/jobs",
        data=json.dumps(job).encode(),
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}",
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates"},
        method="POST")
    try:
        urllib.request.urlopen(req, timeout=30).read()
        print(f"  插入: {job['title'][:40]}")
    except Exception as e:
        print(f"  失败: {e}")
