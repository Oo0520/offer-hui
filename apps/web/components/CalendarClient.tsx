"use client";

import { useMemo, useState } from "react";
import type { JobView } from "@/lib/jobs";

function pad(n: number) {
  return n < 10 ? "0" + n : "" + n;
}

export default function CalendarClient({ jobs }: { jobs: JobView[] }) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState<string | null>(todayStr);
  const [showSub, setShowSub] = useState(false);
  const subUrl =
    typeof window !== "undefined"
      ? window.location.origin.replace(/^http/, "webcal") + "/api/calendar.ics"
      : "";
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    if (!subUrl) return;
    navigator.clipboard.writeText(subUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // date -> jobs
  const byDate = useMemo(() => {
    const m = new Map<string, JobView[]>();
    for (const j of jobs) {
      if (!j.deadlineAt) continue;
      const k = j.deadlineAt;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(j);
    }
    return m;
  }, [jobs]);

  const { y, m } = ym;
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const dim = new Date(y, m + 1, 0).getDate();

  const cells: { d: number; jobs: JobView[]; isToday: boolean }[] = [];
  for (let d = 1; d <= dim; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`;
    cells.push({ d, jobs: byDate.get(k) || [], isToday: k === todayStr });
  }

  const selJobs = sel ? byDate.get(sel) || [] : [];
  const selLabel = sel ? sel.slice(5) : "";

  function prev() {
    setYm(({ y: yy, m: mm }) => (mm === 0 ? { y: yy - 1, m: 11 } : { y: yy, m: mm - 1 }));
    setSel(null);
  }
  function next() {
    setYm(({ y: yy, m: mm }) => (mm === 11 ? { y: yy + 1, m: 0 } : { y: yy, m: mm + 1 }));
    setSel(null);
  }

  // ICS：未来 30 天内截止
  function downloadIcs() {
    const soon = jobs
      .filter((j) => j.deadlineDays !== null && j.deadlineDays >= 0 && j.deadlineDays <= 30)
      .sort((a, b) => (a.deadlineDays || 0) - (b.deadlineDays || 0));
    if (soon.length === 0) {
      alert("未来 30 天暂无标注截止日期的岗位，暂无可订阅的 DDL。");
      return;
    }
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//OfferHui//CN",
      "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:Offer汇 校招截止提醒",
    ];
    for (const j of soon) {
      const date = (j.deadlineAt || "").replace(/-/g, "");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${j.id}@offerhui`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `DTSTART;VALUE=DATE:${date}`,
        `SUMMARY:截止提醒 · ${j.title}（${j.company}）`,
        `DESCRIPTION:${j.applyUrl}`,
        "END:VEVENT"
      );
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "offerhui-ddl.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="wrap">
      <div className="page-hero">
        <div>
          <h1 className="h-display">校招日历</h1>
          <p>按月查看岗位截止日期，点击日期查看当日截止岗位。不登录也可订阅。</p>
          <div className="tags-row">
            <span>标注截止日期岗位 {byDate.size} 个</span>
            <span>30 天内截止 {jobs.filter((j) => j.deadlineDays !== null && j.deadlineDays >= 0 && j.deadlineDays <= 30).length} 个</span>
          </div>
        </div>
        <div className="orbital">
          <button className="inner" onClick={() => setShowSub(!showSub)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="#fff" strokeWidth="2" />
              <path d="m9 16 2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {showSub ? "收起订阅" : "订阅日历"}
          </button>
        </div>
      </div>

      {showSub && (
        <div className="sub-panel glass">
          <div className="sub-row">
            <span className="sub-label">订阅 URL（手机日历填这个）</span>
            <code className="sub-url">{subUrl}</code>
            <button className="sub-copy" onClick={copyUrl}>
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <div className="sub-actions">
            <button className="sub-btn" onClick={downloadIcs}>
              下载 ICS 文件（一次性导入）
            </button>
          </div>
          <div className="sub-tips">
            <p><b>iPhone：</b>设置 → 日历 → 账户 → 添加账户 → 其他 → 添加已订阅日历 → 粘贴 URL</p>
            <p><b>安卓（华为/小米/OPPO）：</b>日历 App → 订阅/添加日历 → 通过 URL 订阅 → 粘贴 URL</p>
            <p style={{ color: "rgba(183,198,194,.55)" }}>URL 订阅会自动同步新岗位；本地 localhost 手机访问不到，部署到公网后即可使用。</p>
          </div>
        </div>
      )}

      <div className="cal-main">
        <div className="cal-card glass">
          <div className="cal-head">
            <div className="ym">
              {y} 年 {m + 1} 月
            </div>
            <div className="cal-nav">
              <button onClick={prev}>‹</button>
              <button onClick={next}>›</button>
            </div>
          </div>
          <div className="cal-grid-big">
            <div className="cw">
              {"一二三四五六日".split("").map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="cd">
              {Array.from({ length: first }).map((_, i) => (
                <div key={"e" + i} className="day empty" />
              ))}
              {cells.map((c) => (
                <div
                  key={c.d}
                  className={
                    "day" +
                    (sel === `${y}-${pad(m + 1)}-${pad(c.d)}` ? " sel" : "") +
                    (c.isToday ? " today" : "")
                  }
                  onClick={() => setSel(`${y}-${pad(m + 1)}-${pad(c.d)}`)}
                >
                  {c.d}
                  {c.jobs.length > 0 && <span className="ct">{c.jobs.length} 岗</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cal-card glass">
          <h4 className="h-sub" style={{ marginBottom: 14 }}>
            当日截止{" "}
            <span style={{ fontSize: 12, color: "rgba(183,198,194,.6)", fontWeight: 700 }}>
              {sel ? `${sel.slice(0, 4)} 年 ${selLabel.replace("-", " 月 ")} 日` : ""}
            </span>
          </h4>
          <div className="daylist">
            {!sel ? (
              <div style={{ padding: "26px 0", textAlign: "center", color: "rgba(183,198,194,.6)", fontSize: 12.5 }}>
                点击日历中的日期，查看当日截止岗位
              </div>
            ) : selJobs.length === 0 ? (
              <div style={{ padding: "26px 0", textAlign: "center", color: "rgba(183,198,194,.6)", fontSize: 12.5 }}>
                该日暂无标注截止的岗位
              </div>
            ) : (
              selJobs.map((j) => (
                <a
                  key={j.id}
                  className="dl-item"
                  href={j.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="ic" style={{ background: j.bg }}>
                    {j.lg}
                  </span>
                  <div>
                    <div className="tt">{j.title}</div>
                    <div className="cp">
                      {j.company} · {j.city} · {j.jobType} · {j.cohort || "届别未标注"}
                    </div>
                  </div>
                  <span className="go">
                    官方投递
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M7 17 17 7M9 7h8v8" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
