"""
爬取福建理工大学就业网宣讲会数据
https://fjut.jysd.com/teachin
存入 jobs 表，jobType='招聘会'
"""
import re
import time
import psycopg
import requests
from bs4 import BeautifulSoup
from datetime import datetime

BASE = "https://fjut.jysd.com/teachin/index/domain/fjut/a/y/page/{page}"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
SOURCE = "福建理工大学就业网"
SOURCE_URL = "https://fjut.jysd.com/teachin"

def parse_page(html):
    """解析一页宣讲会列表"""
    soup = BeautifulSoup(html, "html.parser")
    results = []
    # 找所有 li 含"线下"或"线上"的
    for li in soup.find_all("li"):
        text = li.get_text(" ", strip=True)
        if not text:
            continue
        # 格式：线下 公司名 地点 时间
        m = re.match(r"^(线下|线上)\s+(.+?)\s{2,}(.+?)\s{2,}(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}-\d{2}:\d{2})", text)
        if not m:
            continue
        mode, company, location, time_str = m.groups()
        # 解析时间
        try:
            dt = datetime.strptime(time_str.strip(), "%Y-%m-%d %H:%M-%H:%M")
        except:
            dt = None
        results.append({
            "company": company.strip(),
            "title": f"{company.strip()} 宣讲会",
            "location": location.strip(),
            "time": time_str.strip(),
            "mode": mode,
            "deadline_at": dt,
        })
    return results

def main():
    conn = psycopg.connect(
        "postgresql://postgres.sqmgjxazzpcfjutzscyu:zxzvbSSDG2741@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
        prepare_threshold=None,
    )
    cur = conn.cursor()

    total = 0
    for page in range(1, 31):
        url = BASE.format(page=page)
        print(f"第 {page}/30 页...", end=" ")
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.encoding = "utf-8"
            items = parse_page(r.text)
            print(f"{len(items)} 条")
            if not items:
                print("  (无数据，停止)")
                break
            for item in items:
                # 去重：company + title + deadline_at
                cur.execute(
                    "SELECT id FROM jobs WHERE company=%s AND title=%s AND deadline_at=%s AND job_type='招聘会'",
                    (item["company"], item["title"], item["deadline_at"]),
                )
                if cur.fetchone():
                    continue
                # 插入
                cur.execute(
                    """INSERT INTO jobs (company, title, city, job_type, degree, deadline_at, source, source_url, created_at, updated_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())""",
                    (
                        item["company"],
                        item["title"],
                        "福州",
                        "招聘会",
                        "不限",
                        item["deadline_at"],
                        SOURCE,
                        SOURCE_URL,
                    ),
                )
                total += 1
            conn.commit()
            time.sleep(1)  # 礼貌延迟
        except Exception as e:
            print(f"  错误: {e}")
            break

    conn.close()
    print(f"\n完成，新增 {total} 条宣讲会")

if __name__ == "__main__":
    main()
