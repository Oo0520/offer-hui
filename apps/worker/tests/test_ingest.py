# -*- coding: utf-8 -*-
"""去重/增量逻辑单元测试（不联网，验证存储层核心逻辑）。"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models import Job  # noqa: E402
from app.storage import SqliteStorage  # noqa: E402


def make_job(title="软件工程师", external_id="ext-1", city="北京", salary=10):
    j = Job(
        source="test",
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
        self.tmp = tempfile.mkdtemp()
        self.st = SqliteStorage(os.path.join(self.tmp, "test.db"))

    def tearDown(self):
        self.st.close()

    def test_new_then_skip_then_update(self):
        j1 = make_job()
        self.assertEqual(self.st.upsert_job(j1), "new")
        self.assertEqual(self.st.stats()["total"], 1)
        # 相同内容再入库 → skipped（去重生效）
        j1b = make_job()
        self.assertEqual(self.st.upsert_job(j1b), "skipped")
        # 内容变化（薪资/地点）→ updated
        j2 = make_job(city="上海", salary=12)
        self.assertEqual(self.st.upsert_job(j2), "updated")
        self.assertEqual(self.st.stats()["total"], 1)

    def test_same_external_diff_source_kept(self):
        a = make_job()
        b = make_job()
        b.source = "test2"
        self.assertEqual(self.st.upsert_job(a), "new")
        self.assertEqual(self.st.upsert_job(b), "new")
        self.assertEqual(self.st.stats()["total"], 2)

    def test_mark_expired(self):
        j = make_job()
        self.st.upsert_job(j)
        n = self.st.mark_expired("test", {"other-id"})
        self.assertEqual(n, 1)
        rows = self.st.list_jobs(status="published")
        self.assertEqual(len(rows), 0)
        rows2 = self.st.list_jobs(status="expired")
        self.assertEqual(len(rows2), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
