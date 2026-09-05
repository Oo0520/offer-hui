# -*- coding: utf-8 -*-
"""存储层：PostgresStorage（Supabase Postgres 直连）。

统一接口：upsert_job(job) -> 'new' | 'updated' | 'skipped'
去重逻辑：UNIQUE(source, external_id) + content_hash 变化检测。
"""
import json
import uuid

from .models import Job


def _uuid(key: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, key))


class PostgresStorage:
    """Postgres 直连存储（psycopg3）。表结构由迁移建立，此处只做读写。"""

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
