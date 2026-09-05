# -*- coding: utf-8 -*-
"""把飞书招聘抓到的岗位 JSON 入库 Supabase"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from app.models import Job
from app.storage import PostgresStorage


def load_env():
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def main():
    load_env()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("缺少 DATABASE_URL")
        return

    storage = PostgresStorage(dsn)

    with open("_feishu_jobs.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"待入库: {len(data)} 条")
    new_count = 0
    updated_count = 0
    skipped_count = 0

    for i, item in enumerate(data):
        job = Job(
            source=item["source"],
            source_url=item["source_url"],
            external_id=item["external_id"],
            title=item["title"],
            company_name=item["company_name"],
            city=item.get("city", ""),
            industry=item.get("industry", ""),
            job_type=item.get("job_type", "campus"),
            degree=item.get("degree", ""),
            cohort=item.get("cohort", ""),
            salary_text=item.get("salary_text", ""),
            deadline_at=item.get("deadline_at") or "",
            posted_at=item.get("posted_at", ""),
            apply_url=item.get("apply_url", ""),
            tags=[],
        )
        result = storage.upsert_job(job)
        if result == "new":
            new_count += 1
        elif result == "updated":
            updated_count += 1
        else:
            skipped_count += 1

        if (i + 1) % 30 == 0:
            print(f"  进度 {i+1}/{len(data)}: new={new_count} updated={updated_count} skipped={skipped_count}")

    print(f"\n完成: new={new_count} updated={updated_count} skipped={skipped_count}")


if __name__ == "__main__":
    main()
