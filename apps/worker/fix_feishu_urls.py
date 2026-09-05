# -*- coding: utf-8 -*-
"""批量更新飞书招聘企业岗位的跳转链接为招聘首页"""
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


HOME_URLS = {
    "feishu_nio": "https://nio.jobs.feishu.cn/index",
    "feishu_mi": "https://mi.jobs.feishu.cn/index",
    "feishu_xiaopeng": "https://xiaopeng.jobs.feishu.cn/index",
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
        "Prefer": "return=representation",
    }

    for source, home_url in HOME_URLS.items():
        # 先查数量
        r = httpx.get(
            f"{url}/rest/v1/jobs",
            headers=headers,
            params={"source": f"eq.{source}", "select": "id", "limit": 1},
        )
        count = r.headers.get("content-range", "").split("/")[-1]
        print(f"{source}: 共 {count} 条，更新跳转链接为 {home_url}")

        # 批量更新 apply_url（source_url 保留岗位详情页，有唯一约束）
        r = httpx.patch(
            f"{url}/rest/v1/jobs",
            headers=headers,
            params={"source": f"eq.{source}"},
            json={"apply_url": home_url},
        )
        if r.status_code in (200, 204):
            updated = len(r.json()) if r.status_code == 200 else "unknown"
            print(f"  成功更新 {updated} 条")
        else:
            print(f"  失败: {r.status_code} {r.text[:200]}")


if __name__ == "__main__":
    main()
