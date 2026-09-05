# -*- coding: utf-8 -*-
"""批量更新飞书招聘企业岗位的跳转链接为具体岗位详情页"""
import os
import sys
from pathlib import Path
import httpx

sys.path.insert(0, str(Path(__file__).parent))


def load_env():
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


TENANT_MAP = {
    "feishu_nio": "nio",
    "feishu_mi": "mi",
    "feishu_xiaopeng": "xiaopeng",
}


def main():
    load_env()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("缺少 Supabase 凭据")
        return

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    for source, tenant in TENANT_MAP.items():
        # 查出所有该源的岗位 id 和 external_id
        r = httpx.get(
            f"{url}/rest/v1/jobs",
            headers=headers,
            params={"source": f"eq.{source}", "select": "id,external_id", "limit": 1000},
        )
        jobs = r.json()
        print(f"{source}: {len(jobs)} 条")

        # 逐条更新
        updated = 0
        for job in jobs:
            ext = job["external_id"]  # feishu_nio_7676301029218076970
            job_id = ext.replace(f"{source}_", "")
            new_url = f"https://{tenant}.jobs.feishu.cn/campus/position/{job_id}/detail"
            r2 = httpx.patch(
                f"{url}/rest/v1/jobs",
                headers=headers,
                params={"id": f"eq.{job['id']}"},
                json={"apply_url": new_url},
            )
            if r2.status_code in (200, 204):
                updated += 1

        print(f"  已更新 {updated} 条 → https://{tenant}.jobs.feishu.cn/campus/position/{{id}}/detail")


if __name__ == "__main__":
    main()
