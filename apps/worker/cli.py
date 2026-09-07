# -*- coding: utf-8 -*-
"""命令行入口：python cli.py crawl / list / stats / init-supabase"""
import argparse
import asyncio
import json

from app.config import settings
from app.ingest import get_storage, run_pipeline


def cmd_crawl(args):
    result = asyncio.run(run_pipeline(dry_run=args.dry))
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_list(args):
    st = get_storage()
    rows = st.list_jobs(limit=args.limit, status=args.status)
    print(f"共 {len(rows)} 条岗位（status={args.status}）")
    for r in rows:
        dl = (r["deadline_at"] or "-").replace("T", " ")[:16]
        print(f"  [{r['source']}] {r['title'][:34]} | {r['company_name'][:18]} | "
              f"地点:{r['city'][:14]} | 学历:{r['degree'] or '-'} | 截止:{dl}")


def cmd_stats(args):
    st = get_storage()
    print(json.dumps(st.stats(), ensure_ascii=False, indent=2))


def cmd_scheduler(args):
    """透传调度器参数：python cli.py scheduler [--now] [--once] [--hour N]"""
    import sys

    from scheduler import main as sched_main

    sys.argv = ["scheduler"]
    if args.now:
        sys.argv.append("--now")
    if args.once:
        sys.argv.append("--once")
    if args.hour != 2:
        sys.argv += ["--hour", str(args.hour)]
    sched_main()


def main():
    parser = argparse.ArgumentParser(prog="offer-worker", description="OfferHub 数据管道")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("crawl", help="抓取所有数据源并入库")
    p.add_argument("--dry", action="store_true", help="只抓取统计，不写库")
    p.set_defaults(func=cmd_crawl)

    p = sub.add_parser("list", help="查看库内岗位")
    p.add_argument("--limit", type=int, default=30)
    p.add_argument("--status", default="published")
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("stats", help="查看库统计")
    p.set_defaults(func=cmd_stats)

    p = sub.add_parser("scheduler", help="启动定时抓取调度器（每天自动爬）")
    p.add_argument("--now", action="store_true", help="启动前立即执行一次")
    p.add_argument("--once", action="store_true", help="只执行一次后退出")
    p.add_argument("--hour", type=int, default=2, help="每日抓取小时（默认 2 点）")
    p.set_defaults(func=cmd_scheduler)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
