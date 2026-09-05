# -*- coding: utf-8 -*-
"""验证云端数据分布与新源样例。"""
import os
import json
from collections import Counter

import httpx
from dotenv import load_dotenv

load_dotenv("E:/AIMemory/DaoBao/offer-hui/apps/worker/.env")
url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": key, "Authorization": "Bearer " + key}


def q(path):
    r = httpx.get(url + "/rest/v1/" + path, headers=H, timeout=30)
    r.raise_for_status()
    return r.json()


rows = q("jobs?select=source")
cnt = Counter(r["source"] for r in rows)
print("总岗位:", len(rows), "| 按来源:", dict(cnt))

for s in ["fjut", "fjrclh", "fj99"]:
    sample = q(f"jobs?source=eq.{s}&select=title,company_name,city,job_type,deadline_at,apply_url,tags&limit=3&order=posted_at.desc.nullslast")
    print(f"\n--- {s} 样例 ---")
    for j in sample:
        tags = json.dumps(j.get("tags") or [], ensure_ascii=False)[:70]
        print(f"  {(j['title'] or '')[:26]} | {(j.get('company_name') or '')[:16]} | {j.get('city') or ''} | {j.get('job_type') or ''} | 截止:{(j.get('deadline_at') or '-')[:10]} | {tags}")
