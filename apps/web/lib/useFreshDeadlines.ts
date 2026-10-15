"use client";

// 截止天数改为**浏览器按访问者当天现算**。
//
// 事故（2026-10-15）：deadlineDays 原先是 force-static 页面在**生成那一刻**算好、
// 随 payload 发出去的。这 5 个静态页不设 revalidate，只在爬虫调 /api/revalidate 时
// 重生成；当天定时任务漏跑（run-daily.log 最后一条 10-14 12:22），页面就被冻在昨天，
// 于是 10-14 已到期的 8 条被继续标成「今天截止」（线上实测陈旧 30 小时，Age: 107950）。
// 天数是相对**访问者当天**的展示值，本就不该由服务端定死。
//
// 修法：服务端只提供稳定的「截止日期」（bjDateOf，已按北京时区），
//       天数由这里按当天现算；跨北京 0 点自动重算，标签页长期开着也准。
//
// 水合一致性：首帧沿用服务端烤好的值（SSR HTML 与首次客户端渲染一致），
// 挂载后（useEffect）再切到现算值，因此不会触发 React 水合不匹配。

import { useEffect, useMemo, useState } from "react";
import { JobView, bjDateStr, bjDayDiff, msToNextBjMidnight } from "./jobs";

export function useFreshDeadlines(jobs: JobView[]): JobView[] {
  // null = 尚未挂载：保持服务端值，保证首次渲染与水合一致
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setToday(bjDateStr());
      // 跨北京 0 点后再算一次（+1s 留出边界余量）
      timer = setTimeout(tick, msToNextBjMidnight() + 1000);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return useMemo(() => {
    if (!today) return jobs;
    let changed = false;
    const next = jobs.map((j) => {
      const days = j.deadlineAt ? bjDayDiff(today, j.deadlineAt) : null;
      if (days === j.deadlineDays) return j;
      changed = true;
      return { ...j, deadlineDays: days };
    });
    // 无变化时返回原数组，避免下游 useMemo 全部失效重算
    return changed ? next : jobs;
  }, [jobs, today]);
}
