# -*- coding: utf-8 -*-
"""存储层：SqliteStorage（本地）+ PostgresStorage（云/Postgres）+ SupabaseStorage（REST 预留）。

接口统一：upsert_job(job) -> 'new' | 'updated' | 'skipped'
去重逻辑核心：UNIQUE(source, external_id) + content_hash 变化检测。
"""
import hashlib
import json
import sqlite3
import uuid
from pathlib import Path

from .models import Job

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  industry TEXT,
  website TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_name ON companies(name);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  city TEXT,
  industry TEXT,
  job_type TEXT,
  degree TEXT,
  cohort TEXT,
  salary_min REAL,
  salary_max REAL,
  salary_text TEXT,
  deadline_at TEXT,
  posted_at TEXT,
  apply_url TEXT,
  status TEXT DEFAULT 'published',
  tags TEXT DEFAULT '[]',
  content_hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_jobs_deadline ON jobs(deadline_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_posted ON jobs(posted_at);
CREATE INDEX IF NOT EXISTS idx_jobs_city ON jobs(city);
"""


def _id(key: str) -> str:
    return hashlib.md5(key.encode("utf-8")).hexdigest()


class SqliteStorage:
    def __init__(self, db_path: str):
        p = Path(db_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(p))
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.executescript(SCHEMA_SQL)
        self.conn.commit()

    # ---- 去重与更新 ----
    def upsert_job(self, job: Job) -> str:
        row = self._find(job.source, job.external_id)
        if row is None:
            self._insert(job)
            return "new"
        if row["content_hash"] != job.content_hash:
            self._update(job)
            return "updated"
        return "skipped"

    def _find(self, source: str, external_id: str):
        cur = self.conn.execute(
            "SELECT * FROM jobs WHERE source=? AND external_id=?",
            (source, external_id),
        )
        return cur.fetchone()

    def _insert(self, job: Job):
        self.conn.execute(
            "INSERT OR IGNORE INTO companies(id, name, industry, website, created_at) "
            "VALUES (?,?,?,?, datetime('now'))",
            (_id(job.company_name), job.company_name, job.industry, ""),
        )
        self.conn.execute(
            """INSERT INTO jobs (id, company_id, source, source_url, external_id,
                 title, city, industry, job_type, degree, cohort,
                 salary_min, salary_max, salary_text, deadline_at, posted_at,
                 apply_url, status, tags, content_hash)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                _id(f"{job.source}:{job.external_id}"),
                _id(job.company_name),
                job.source, job.source_url, job.external_id,
                job.title, job.city, job.industry, job.job_type, job.degree,
                job.cohort, job.salary_min, job.salary_max, job.salary_text,
                job.deadline_at, job.posted_at, job.apply_url, "published",
                json.dumps(job.tags, ensure_ascii=False), job.content_hash,
            ),
        )
        self.conn.commit()

    def _update(self, job: Job):
        self.conn.execute(
            """UPDATE jobs SET title=?, city=?, industry=?, job_type=?, degree=?,
                 salary_min=?, salary_max=?, salary_text=?, deadline_at=?,
                 posted_at=?, apply_url=?, status='published', tags=?,
                 content_hash=?, updated_at=datetime('now')
               WHERE source=? AND external_id=?""",
            (
                job.title, job.city, job.industry, job.job_type, job.degree,
                job.salary_min, job.salary_max, job.salary_text, job.deadline_at,
                job.posted_at, job.apply_url,
                json.dumps(job.tags, ensure_ascii=False), job.content_hash,
                job.source, job.external_id,
            ),
        )
        self.conn.commit()

    # ---- 查询 ----
    def stats(self) -> dict:
        total = self.conn.execute("SELECT COUNT(*) c FROM jobs").fetchone()["c"]
        by_source = {}
        for r in self.conn.execute(
            "SELECT source, COUNT(*) c FROM jobs GROUP BY source"
        ):
            by_source[r["source"]] = r["c"]
        return {"total": total, "by_source": by_source}

    def list_jobs(self, limit: int = 50, status: str = "published"):
        cur = self.conn.execute(
            """SELECT j.*, c.name AS company_name
               FROM jobs j LEFT JOIN companies c ON j.company_id = c.id
               WHERE j.status=? ORDER BY j.posted_at DESC, j.created_at DESC LIMIT ?""",
            (status, limit),
        )
        return [dict(r) for r in cur.fetchall()]

    def mark_expired(self, source: str, alive_external_ids: set) -> int:
        """将某源在本次爬取中未出现的记录标记为 expired（增量清理）。"""
        cur = self.conn.execute(
            "SELECT external_id FROM jobs WHERE source=? AND status='published'",
            (source,),
        )
        to_expire = [
            r["external_id"]
            for r in cur.fetchall()
            if r["external_id"] not in alive_external_ids
        ]
        for ext in to_expire:
            self.conn.execute(
                "UPDATE jobs SET status='expired', updated_at=datetime('now') "
                "WHERE source=? AND external_id=?",
                (source, ext),
            )
        if to_expire:
            self.conn.commit()
        return len(to_expire)

    def close(self):
        self.conn.close()


class SupabaseStorage:
    """Supabase 存储（预留接入）。配置 STORAGE_BACKEND=supabase 后启用。"""

    def __init__(self, url: str, service_key: str):
        if not url or not service_key:
            raise RuntimeError(
                "未配置 SUPABASE_URL / SUPABASE_SERVICE_KEY。"
                "请先在 supabase.com 创建项目并填入 .env，或使用 sqlite 后端。"
            )
        try:
            from supabase import create_client
        except ImportError:
            raise RuntimeError("未安装 supabase 客户端：pip install supabase")
        self.client = create_client(url, service_key)

    def upsert_job(self, job: Job) -> str:
        company_id = self._company_id(job.company_name)
        payload = job.to_dict()
        payload.pop("company_name", None)
        # 空日期转 NULL（Supabase timestamptz 不接受空串）
        payload["deadline_at"] = payload.get("deadline_at") or None
        payload["posted_at"] = payload.get("posted_at") or None
        payload["company_id"] = company_id
        payload["id"] = _uuid(f"{job.source}:{job.external_id}")
        payload["status"] = "published"
        payload["tags"] = json.dumps(payload.get("tags") or [], ensure_ascii=False)

        existing = (
            self.client.table("jobs")
            .select("content_hash")
            .eq("source", job.source)
            .eq("external_id", job.external_id)
            .execute()
        )
        if not existing.data:
            self.client.table("jobs").insert(payload).execute()
            return "new"
        if existing.data[0]["content_hash"] != job.content_hash:
            self.client.table("jobs").update(payload).eq(
                "source", job.source
            ).eq("external_id", job.external_id).execute()
            return "updated"
        return "skipped"

    def _company_id(self, name: str) -> str:
        existing = (
            self.client.table("companies").select("id").eq("name", name).execute()
        )
        if existing.data:
            return existing.data[0]["id"]
        res = self.client.table("companies").insert({"name": name}).execute()
        return res.data[0]["id"]

    def stats(self) -> dict:
        return {"note": "supabase stats via SQL"}

    def list_jobs(self, limit: int = 50, status: str = "published"):
        return self.client.table("jobs").select("*").eq("status", status).limit(limit).execute().data

    def mark_expired(self, source: str, alive_external_ids: set) -> int:
        return 0


def _uuid(key: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, key))


class PostgresStorage:
    """Postgres 直连存储（psycopg3）。表结构由 migrate.py 建立，此处只做读写。"""

    def __init__(self, dsn: str):
        if not dsn:
            raise RuntimeError("未配置 DATABASE_URL（Postgres 连接串）。")
        import psycopg

        self._psycopg = psycopg
        self.conn = psycopg.connect(dsn, autocommit=True)

    def upsert_job(self, job: Job) -> str:
        with self.conn.cursor() as cur:
            company_id = self._company_id(cur, job.company_name, job.industry)
            existing = cur.execute(
                "SELECT content_hash FROM jobs WHERE source=%s AND external_id=%s",
                (job.source, job.external_id),
            ).fetchone()
            payload = (
                _uuid(f"{job.source}:{job.external_id}"),
                company_id, job.source, job.source_url, job.external_id,
                job.title, job.city, job.industry, job.job_type, job.degree,
                job.cohort, job.salary_min, job.salary_max, job.salary_text,
                job.deadline_at or None, job.posted_at or None,
                job.apply_url, "published",
                json.dumps(job.tags or [], ensure_ascii=False), job.content_hash,
            )
            if existing is None:
                cur.execute(
                    """INSERT INTO jobs (id, company_id, source, source_url,
                         external_id, title, city, industry, job_type, degree,
                         cohort, salary_min, salary_max, salary_text,
                         deadline_at, posted_at, apply_url, status, tags,
                         content_hash)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    payload,
                )
                return "new"
            if existing[0] != job.content_hash:
                cur.execute(
                    """UPDATE jobs SET title=%s, city=%s, industry=%s, job_type=%s,
                         degree=%s, cohort=%s, salary_min=%s, salary_max=%s,
                         salary_text=%s, deadline_at=%s, posted_at=%s,
                         apply_url=%s, status='published', tags=%s,
                         content_hash=%s, updated_at=now()
                       WHERE source=%s AND external_id=%s""",
                    (
                        job.title, job.city, job.industry, job.job_type,
                        job.degree, job.cohort, job.salary_min, job.salary_max,
                        job.salary_text, job.deadline_at or None,
                        job.posted_at or None, job.apply_url,
                        json.dumps(job.tags or [], ensure_ascii=False),
                        job.content_hash, job.source, job.external_id,
                    ),
                )
                return "updated"
            return "skipped"

    def _company_id(self, cur, name: str, industry: str) -> str:
        cur.execute("SELECT id FROM companies WHERE name=%s", (name,))
        row = cur.fetchone()
        if row:
            return row[0]
        cid = _uuid(f"company:{name}")
        cur.execute(
            "INSERT INTO companies (id, name, industry) VALUES (%s,%s,%s) "
            "ON CONFLICT (name) DO UPDATE SET industry=EXCLUDED.industry",
            (cid, name, industry or ""),
        )
        return cid

    def stats(self) -> dict:
        with self.conn.cursor() as cur:
            total = cur.execute("SELECT count(*) FROM jobs").fetchone()[0]
            by_source = dict(cur.execute(
                "SELECT source, count(*) FROM jobs GROUP BY source"
            ).fetchall())
        return {"total": total, "by_source": by_source}

    def list_jobs(self, limit: int = 50, status: str = "published"):
        with self.conn.cursor() as cur:
            cur.execute(
                """SELECT j.*, c.name AS company_name
                   FROM jobs j LEFT JOIN companies c ON j.company_id = c.id
                   WHERE j.status=%s ORDER BY j.posted_at DESC NULLS LAST,
                     j.created_at DESC LIMIT %s""",
                (status, limit),
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]

    def mark_expired(self, source: str, alive_external_ids: set) -> int:
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT external_id FROM jobs WHERE source=%s AND status='published'",
                (source,),
            )
            to_expire = [r[0] for r in cur.fetchall() if r[0] not in alive_external_ids]
            for ext in to_expire:
                cur.execute(
                    "UPDATE jobs SET status='expired', updated_at=now() "
                    "WHERE source=%s AND external_id=%s",
                    (source, ext),
                )
        return len(to_expire)

    def close(self):
        self.conn.close()
