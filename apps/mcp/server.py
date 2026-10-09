# -*- coding: utf-8 -*-
"""Offer派 · MCP Server（Agent 接入层）

将 Offer派 岗位数据通过 MCP 协议暴露给任意 AI Agent（豆包/Claude/Cursor/DeepSeek 等）。

工具：
  - query_jobs      按城市/届别/学历/类型/关键词筛选岗位，支持排序分页
  - get_job_detail  按 job_id 查单条岗位详情
  - get_sources     数据源清单
  - get_stats       全库统计

传输：Streamable HTTP（uvicorn，默认 8001 端口）
启动：
  python apps/mcp/server.py            # 默认 0.0.0.0:8001
  python apps/mcp/server.py --port 8001
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

# 复用 apps/worker/.env 的 DATABASE_URL（psycopg 直连 Supabase）
WORKER_ENV = Path(__file__).parent.parent / "worker" / ".env"

from dotenv import load_dotenv

load_dotenv(WORKER_ENV)

import os

import psycopg
from fastmcp import FastMCP

DSN = os.getenv("DATABASE_URL", "")
if not DSN:
    sys.exit("错误: 未找到 DATABASE_URL（apps/worker/.env）")

mcp = FastMCP("offerp", instructions="Offer派应届生求职信息聚合服务。提供校招/实习岗位查询、数据源与统计信息，所有岗位均有官方来源链接。")

# ---- 简易全局限流：60s 窗口最多 120 次工具调用 ----
_WINDOW = 60.0
_MAX_CALLS = 120
_calls: list[float] = []


def _check_rate() -> None:
    now = time.monotonic()
    while _calls and now - _calls[0] > _WINDOW:
        _calls.pop(0)
    if len(_calls) >= _MAX_CALLS:
        raise RuntimeError("请求过于频繁，请稍后再试（60 秒窗口内最多 120 次调用）")
    _calls.append(now)


def _conn():
    return psycopg.connect(DSN, autocommit=True, prepare_threshold=None)


_DEGREE_CASE = """
CASE
  WHEN j.degree IS NULL OR j.degree = '' OR j.degree LIKE '%%不限%%' THEN 0
  WHEN j.degree LIKE '%%博士%%' THEN 4
  WHEN j.degree LIKE '%%硕士%%' THEN 3
  WHEN j.degree LIKE '%%本科%%' THEN 2
  WHEN j.degree LIKE '%%专科%%' OR j.degree LIKE '%%大专%%' THEN 1
  ELSE 0
END
"""

_DEGREE_MIN = {"专科及以上": 1, "本科及以上": 2, "硕士及以上": 3}

_SORT_SQL = {
    "deadline": """
      ORDER BY
        CASE WHEN j.deadline_at IS NOT NULL AND j.deadline_at::date >= CURRENT_DATE THEN 0
             WHEN j.deadline_at IS NOT NULL THEN 1 ELSE 2 END,
        (CASE WHEN j.deadline_at IS NOT NULL THEN (j.deadline_at::date - CURRENT_DATE) END) ASC NULLS LAST,
        j.posted_at DESC NULLS LAST
    """,
    "newest": "ORDER BY j.posted_at DESC NULLS LAST, j.created_at DESC",
    "salary": "ORDER BY j.salary_min DESC NULLS LAST, j.salary_max DESC NULLS LAST",
}


def _row_to_job(r) -> dict:
    return {
        "id": str(r[0]),
        "title": r[1],
        "company": r[2] or "官方发布",
        "city": r[3] or "全国",
        "industry": r[4] or "未分类",
        "job_type": "实习" if r[5] == "intern" else ("招聘会" if r[5] == "fair" else "校招"),
        "degree": r[6] or "学历不限",
        "cohort": r[7] or "",
        "salary_text": r[8] or "",
        "deadline_at": r[9].strftime("%Y-%m-%d") if r[9] else None,
        "deadline_days": r[10],
        "posted_at": r[11].strftime("%Y-%m-%d") if r[11] else None,
        "source": r[12],
        "source_url": r[13],
        "apply_url": r[14],
    }


@mcp.tool()
def query_jobs(
    city: str | None = None,
    job_type: str | None = None,
    industry: str | None = None,
    cohort: str | None = None,
    degree: str | None = None,
    keyword: str | None = None,
    sort: str = "deadline",
    page: int = 1,
    page_size: int = 20,
) -> str:
    """查询校招/实习岗位。city=城市(如 北京/上海)，job_type=校招|实习|招聘会，cohort=届别(如 2027届)，degree=不限|专科及以上|本科及以上|硕士及以上，keyword=岗位/公司关键词，sort=deadline(截止最近)|newest(最新)|salary(薪资最高)，page从1开始，page_size默认20。"""
    _check_rate()
    page = max(1, page)
    page_size = min(50, max(1, page_size))
    where = ["j.status = 'published'"]
    args: list = []
    if city:
        where.append("j.city = %s")
        args.append(city)
    if job_type:
        t = {"实习": "intern", "招聘会": "fair"}.get(job_type, "campus")
        if job_type in ("校招", "实习", "招聘会"):
            where.append("j.job_type = %s")
            args.append(t)
    if industry:
        where.append("j.industry = %s")
        args.append(industry)
    if cohort:
        where.append("j.cohort = %s")
        args.append(cohort)
    if degree and degree in _DEGREE_MIN:
        where.append(f"({_DEGREE_CASE} >= %s)")
        args.append(_DEGREE_MIN[degree])
    if keyword:
        where.append("(j.title ILIKE %s OR c.name ILIKE %s OR j.city ILIKE %s)")
        kw = f"%{keyword}%"
        args.extend([kw, kw, kw])
    order = _SORT_SQL.get(sort, _SORT_SQL["deadline"])
    sql = f"""
      SELECT j.id, j.title, c.name, j.city, j.industry, j.job_type, j.degree, j.cohort,
             j.salary_text, j.deadline_at,
             CASE WHEN j.deadline_at IS NOT NULL THEN (j.deadline_at::date - CURRENT_DATE) END,
             j.posted_at, j.source, j.source_url, j.apply_url
      FROM jobs j LEFT JOIN companies c ON j.company_id = c.id
      WHERE {' AND '.join(where)}
      {order}
      LIMIT %s OFFSET %s
    """
    args.extend([page_size, (page - 1) * page_size])
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, args)
            rows = cur.fetchall()
            cur.execute(f"SELECT count(*) FROM jobs j LEFT JOIN companies c ON j.company_id = c.id WHERE {' AND '.join(where)}", args[:-2])
            total = cur.fetchone()[0]
    return json.dumps(
        {"total": total, "page": page, "page_size": page_size, "jobs": [_row_to_job(r) for r in rows]},
        ensure_ascii=False,
    )


@mcp.tool()
def get_job_detail(job_id: str) -> str:
    """按 job_id 查询单个岗位的完整详情（含来源链接与官方投递入口）。"""
    _check_rate()
    sql = """
      SELECT j.id, j.title, c.name, j.city, j.industry, j.job_type, j.degree, j.cohort,
             j.salary_text, j.deadline_at,
             CASE WHEN j.deadline_at IS NOT NULL THEN (j.deadline_at::date - CURRENT_DATE) END,
             j.posted_at, j.source, j.source_url, j.apply_url, j.description
      FROM jobs j LEFT JOIN companies c ON j.company_id = c.id
      WHERE j.id = %s
    """
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (job_id,))
            r = cur.fetchone()
    if not r:
        return json.dumps({"error": "岗位不存在"}, ensure_ascii=False)
    d = _row_to_job(r)
    d["description"] = (r[15] or "")[:500]
    return json.dumps(d, ensure_ascii=False)


@mcp.tool()
def get_sources() -> str:
    """获取数据源清单及各来源岗位数量（国家24365/高校就业网/企业官网/企业公众号/社区数据）。"""
    _check_rate()
    sql = """
      SELECT j.source, c0.name, count(*) FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN (VALUES
        ('ncss','国家24365平台'),('fjut','福建理工大学就业网'),('fjrclh','福建人才联合网'),
        ('fj99','福建就业网'),('feishu_nio','蔚来官网'),('feishu_mi','小米官网'),
        ('feishu_xiaopeng','小鹏汽车官网'),('campus2027','Campus2027社区'),
        ('open_jobs','open-jobs数据'),('wechat','企业公众号'),('manual','手动录入')
      ) AS c0(key,name) ON c0.key = j.source
      WHERE j.status = 'published'
      GROUP BY j.source, c0.name ORDER BY count(*) DESC
    """
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
    return json.dumps([{"source": r[0], "name": r[1] or r[0], "count": r[2]} for r in rows], ensure_ascii=False)


@mcp.tool()
def get_stats() -> str:
    """获取全库岗位统计（总量/公司数/近30天截止岗位数/按类型分布）。"""
    _check_rate()
    sql = """
      SELECT count(*),
             count(DISTINCT j.company_id),
             count(*) FILTER (WHERE j.deadline_at IS NOT NULL AND j.deadline_at::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30),
             count(*) FILTER (WHERE j.job_type = 'campus'),
             count(*) FILTER (WHERE j.job_type = 'intern'),
             count(*) FILTER (WHERE j.job_type = 'fair')
      FROM jobs j WHERE j.status = 'published'
    """
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            r = cur.fetchone()
    return json.dumps(
        {"total": r[0], "companies": r[1], "due30": r[2], "campus": r[3], "intern": r[4], "fair": r[5]},
        ensure_ascii=False,
    )


def main():
    ap = argparse.ArgumentParser(description="Offer派 MCP Server")
    ap.add_argument("--port", type=int, default=8001)
    ap.add_argument("--host", default="0.0.0.0")
    args = ap.parse_args()
    print(f"Offer派 MCP Server 启动: {args.host}:{args.port} (Streamable HTTP)")
    mcp.run(transport="streamable-http", host=args.host, port=args.port)


if __name__ == "__main__":
    main()
