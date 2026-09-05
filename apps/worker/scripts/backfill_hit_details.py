# -*- coding: utf-8 -*-
"""回填哈工大就业网岗位详情：投递邮箱(官方直投) + 公司元数据(性质/规模/地址/简介)。
数据来源：_hit_details.json（由详情 API 抓取），按 job id 与 company id 更新。
用法：python backfill_hit_details.py
"""
import json
import os
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
# 加载 Supabase 凭据
env_path = os.path.join(ROOT, "..", "..", "web", ".env.local")
creds = {}
for line in open(env_path, encoding="utf-8"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, _, v = line.partition("=")
        creds[k.strip()] = v.strip()

URL = creds.get("SUPABASE_URL", "").rstrip("/")
KEY = creds.get("SUPABASE_SERVICE_KEY", "")


def patch(path: str, payload: dict):
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        data=json.dumps(payload).encode("utf-8"),
        method="PATCH",
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    with urllib.request.urlopen(req) as r:
        return r.status


def main():
    data_path = os.path.join(ROOT, "..", "..", "..", "_hit_details.json")
    if not os.path.exists(data_path):
        print("缺少 _hit_details.json，先运行抓取脚本")
        sys.exit(1)
    details = json.load(open(data_path, encoding="utf-8"))
    print(f"待处理 {len(details)} 条")

    n_email, n_comp = 0, 0
    for d in details:
        job_id = d.get("id")
        comp_id = d.get("company_id")
        try:
            # 1) 岗位：投递邮箱/备注
            if job_id and d.get("jltdfs"):
                note_bits = []
                if d.get("wxgzh"):
                    note_bits.append(f"公众号：{d['wxgzh']}")
                if d.get("dwwz"):
                    note_bits.append(f"官网：{d['dwwz']}")
                patch(f"jobs?id=eq.{job_id}", {
                    "official_email": d["jltdfs"].strip(),
                    "official_note": "；".join(note_bits) or None,
                })
                n_email += 1
            # 2) 公司元数据
            if comp_id:
                comp = {}
                if d.get("dwxz"):
                    comp["nature"] = d["dwxz"]
                if d.get("dwgm"):
                    comp["scale"] = d["dwgm"]
                if d.get("dwdz"):
                    comp["address"] = d["dwdz"]
                if d.get("dwhy"):
                    comp["industry"] = d["dwhy"]
                if d.get("dwjj"):
                    comp["profile"] = d["dwjj"][:800]
                if comp:
                    patch(f"companies?id=eq.{comp_id}", comp)
                    n_comp += 1
        except Exception as e:
            print(f"[跳过] {d.get('dwmc', '')[:20]}: {e}")
        time.sleep(0.08)
    print(f"完成：更新岗位邮箱 {n_email} 条，更新公司元数据 {n_comp} 条")


if __name__ == "__main__":
    main()
