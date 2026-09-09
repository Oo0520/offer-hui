# -*- coding: utf-8 -*-
"""定时任务调度器：每天定时抓取 → 入库 → 写监控表。

用法：
    python scheduler.py            # 启动常驻调度（默认每天 02:00 爬取）
    python scheduler.py --now      # 立即执行一次后继续调度
    python scheduler.py --once     # 立即执行一次后退出（供测试/计划任务）
"""
import argparse
import asyncio
import logging
import subprocess
import sys
from pathlib import Path

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from app.ingest import run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("scheduler")


def fjut_full_job():
    """fjut 福建理工全量列表采集（Playwright + 登录态，需独立进程）"""
    script = Path(__file__).parent / "fjut_full.py"
    log.info("开始 fjut 全量采集 ...")
    try:
        res = subprocess.run(
            [sys.executable, str(script)],
            capture_output=True, text=True, timeout=1800, encoding="utf-8",
        )
        tail = (res.stdout or res.stderr or "").strip().splitlines()[-1]
        log.info(f"fjut 全量采集完成：{tail}")
        if res.returncode != 0:
            log.warning(f"fjut 采集异常退出：{(res.stderr or '')[-300:]}")
    except Exception as e:
        log.error(f"fjut 全量采集失败：{e}")


def crawl_job():
    log.info("开始定时抓取 ...")
    result = asyncio.run(run_pipeline())
    results = result.get("results", {})
    ok = sum(1 for s in results.values() if not s.get("error"))
    total = result.get("stats", {}).get("total", 0)
    log.info(f"抓取完成：{ok}/{len(results)} 个源成功，库内共 {total} 条")
    for name, stat in results.items():
        if stat.get("error"):
            log.warning(f"  [{name}] 失败：{stat['error']}")
        else:
            log.info(
                f"  [{name}] 抓到 {stat['found']} 新增 {stat['new']} "
                f"更新 {stat['updated']} 过期 {stat.get('expired', 0)}"
            )


def main():
    parser = argparse.ArgumentParser(description="Offer派 定时爬虫调度器")
    parser.add_argument("--now", action="store_true", help="启动前立即执行一次")
    parser.add_argument("--once", action="store_true", help="只执行一次后退出")
    parser.add_argument("--hour", type=int, default=2, help="每日抓取小时（默认 2 点）")
    args = parser.parse_args()

    if args.once:
        crawl_job()
        fjut_full_job()
        return

    sched = BlockingScheduler(timezone="Asia/Shanghai")
    sched.add_job(
        crawl_job,
        CronTrigger(hour=args.hour, minute=0),
        id="daily_crawl",
        misfire_grace_time=3600,
    )
    sched.add_job(
        fjut_full_job,
        CronTrigger(hour=args.hour, minute=15),
        id="fjut_full_daily",
        misfire_grace_time=3600,
    )
    log.info(f"调度器已启动，每天 {args.hour:02d}:00 常规抓取 / :15 fjut 全量采集")
    if args.now:
        crawl_job()
    try:
        sched.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("调度器已停止")


if __name__ == "__main__":
    main()
