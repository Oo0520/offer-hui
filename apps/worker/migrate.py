# -*- coding: utf-8 -*-
"""数据库迁移执行器：把 infra/supabase/migrations/*.sql 跑在指定 Postgres（Supabase 云库）上。

用法：python migrate.py
（连接串从 .env 的 DATABASE_URL 读取）
"""
import sys
from pathlib import Path

from app.config import settings

MIGRATIONS_DIR = (
    Path(__file__).resolve().parent.parent.parent / "infra" / "supabase" / "migrations"
)


def _split_sql(sql: str) -> list[str]:
    """按分号拆分多条 SQL（本迁移无函数体/DO 块，注释无分号，可安全拆分）。"""
    stmts = []
    for stmt in sql.split(";"):
        lines = [
            l for l in stmt.splitlines()
            if l.strip() and not l.strip().startswith("--")
        ]
        body = "\n".join(lines).strip()
        if body:
            stmts.append(body)
    return stmts


def run_migrations(dsn: str) -> list[str]:
    import psycopg

    applied: list[str] = []
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        raise SystemExit(f"未找到迁移文件：{MIGRATIONS_DIR}")
    with psycopg.connect(dsn, autocommit=True) as conn:
        for f in files:
            sql = f.read_text(encoding="utf-8")
            stmts = _split_sql(sql)
            with conn.cursor() as cur:
                for stmt in stmts:
                    try:
                        cur.execute(stmt)
                    except Exception as e:
                        print(f"[{f.name}] 语句失败: {e}\n  -> {stmt[:120]}")
                        raise
            applied.append(f.name)
            print(f"✓ 已执行 {f.name}（{len(stmts)} 条语句）")
    return applied


if __name__ == "__main__":
    if not settings.database_url:
        print("未配置 DATABASE_URL。请在 .env 填写 Postgres 连接串。")
        sys.exit(1)
    print(f"目标：{settings.database_url.split('@')[-1]}")
    run_migrations(settings.database_url)
