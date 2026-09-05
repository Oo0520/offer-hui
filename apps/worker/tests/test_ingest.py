# -*- coding: utf-8 -*-
"""去重/增量逻辑单元测试（Postgres 直连，测试数据用独立 source，结束后清理）。"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.models import Job  # noqa: E402
from app.storage import PostgresStorage  # noqa: E402

TEST_SOURCE = "__unit_test__"


def make_job(title="软件工程师", external_id="ext-1", city="北京", salary=10):
    j = Job(
        source=TEST_SOURCE,
        source_url=f"https://example.com/{external_id}",
        external_id=external_id,
        title=title,
        company_name="测试公司",
        city=city,
        degree="本科",
        salary_max=salary,
        apply_url=f"https://example.com/{external_id}",
        job_type="campus",
    )
    j.content_hash = j.compute_hash()
    return j


class TestDedup(unittest.TestCase):
    def setUp(self):
        self.st = PostgresStorage(os.getenv("DATABASE_URL"))
        # 清理上次测试残留
        with self.st.conn.cursor() as cur:
            cur.execute("DELETE FROM jobs WHERE source=%s", (TEST_SOURCE,))

    def tearDown(self):
        with self.st.conn.cursor() as cur:
            cur.execute("DELETE FROM jobs WHERE source=%s", (TEST_SOURCE,))
        self.st.close()

    def test_new_then_skip_then_update(self):
        j1 = make_job()
        self.assertEqual(self.st.upsert_job(j1), "new")
        # 相同内容再入库 → skipped（去重生效）
        j1b = make_job()
        self.assertEqual(self.st.upsert_job(j1b), "skipped")
        # 内容变化（薪资/地点）→ updated
        j2 = make_job(city="上海", salary=12)
        self.assertEqual(self.st.upsert_job(j2), "updated")

    def test_same_external_diff_source_kept(self):
        a = make_job(external_id="ext-a")
        b = make_job(external_id="ext-b")
        b.source = TEST_SOURCE + "_b"
        self.assertEqual(self.st.upsert_job(a), "new")
        self.assertEqual(self.st.upsert_job(b), "new")
        # 清理 b 源
        with self.st.conn.cursor() as cur:
            cur.execute("DELETE FROM jobs WHERE source=%s", (TEST_SOURCE + "_b",))

    def test_mark_expired(self):
        j = make_job()
        self.st.upsert_job(j)
        n = self.st.mark_expired(TEST_SOURCE, {"other-id"})
        self.assertEqual(n, 1)
        rows = self.st.list_jobs(status="published")
        self.assertEqual(len([r for r in rows if r["source"] == TEST_SOURCE]), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
