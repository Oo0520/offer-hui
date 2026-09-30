"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { JobView } from "@/lib/jobs";
import { dimOptions, cityOptions, industryOptions, companyTypeOptions } from "@/lib/jobs";
import CityFilterPanel from "./CityFilterPanel";
import { supabase } from "@/lib/supabase";

function pad(n: number) {
  return n < 10 ? "0" + n : "" + n;
}

type PersonalFilters = {
  cities: string[];
  industries: string[];
  company_types: string[];
  job_types: string[];
  cohort: string;
};

const JOB_TYPES = ["校招", "实习", "招聘会", "宣讲会", "招聘公告"];

export default function CalendarClient({ jobs }: { jobs: JobView[] }) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState<string | null>(todayStr);
  const [showSub, setShowSub] = useState(false);
  // 订阅 URL 直接用 https：iOS/安卓日历均原生支持，避免 webcal/webcals 协议兼容问题
  const subUrl =
    typeof window !== "undefined"
      ? window.location.origin + "/api/calendar.ics"
      : "";
  const [copied, setCopied] = useState(false);

  // ---- 个性化订阅 ----
  const [user, setUser] = useState<any>(null);
  const [mySub, setMySub] = useState<string | null>(null); // 个性化订阅 URL
  const [filters, setFilters] = useState<PersonalFilters>({
    cities: [],
    industries: [],
    company_types: [],
    job_types: [],
    cohort: "",
  });
  const [saving, setSaving] = useState(false);

  // ---- 待投看板（与首页/求职看板共用 user_jobs pending）----
  const [boards, setBoards] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  const cityOpts = useMemo(() => cityOptions(jobs), [jobs]);
  const industryOpts = useMemo(() => industryOptions(jobs), [jobs]);
  const companyTypeOpts = useMemo(() => companyTypeOptions(jobs), [jobs]);
  const cohortOpts = useMemo(() => dimOptions(jobs, "cohort"), [jobs]);

  useEffect(() => {
    // 先读 localStorage（未登录也可用，登录后自动上传）
    let localBoards: Record<string, string> = {};
    try {
      localBoards = JSON.parse(localStorage.getItem("offer_board") || "{}");
    } catch {}
    setBoards(localBoards);

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user || null;
      setUser(u);
      if (u) {
        // 上传本地未同步的待投 → 数据库
        supabase
          .from("user_jobs")
          .select("job_id, status")
          .eq("user_id", u.id)
          .then(async ({ data: existing }) => {
            const ex = new Set((existing || []).map((r) => r.job_id + "_" + r.status));
            for (const jobId of Object.keys(localBoards)) {
              if (!ex.has(jobId + "_pending")) {
                await supabase.from("user_jobs").upsert(
                  { user_id: u.id, job_id: jobId, status: "pending" },
                  { onConflict: "user_id,job_id,status" }
                );
              }
            }
            // 读库合并（本地优先，避免未上传数据丢失）
            supabase
              .from("user_jobs")
              .select("job_id, status")
              .eq("user_id", u.id)
              .then(({ data: rows }) => {
                if (!rows) return;
                const b: Record<string, string> = { ...localBoards };
                for (const r of rows) if (r.status === "pending") b[r.job_id] = "待投";
                setBoards(b);
              });
          });
        supabase.auth.getSession().then(async ({ data: s2 }) => {
          const t = s2.session?.access_token;
          if (!t) return;
          const res = await fetch("/api/subscription", {
            headers: { Authorization: `Bearer ${t}` },
          });
          if (res.ok) {
            const j = await res.json();
            setMySub(j.url);
            if (j.filters) {
              setFilters({
                cities: j.filters.cities || [],
                industries: j.filters.industries || [],
                company_types: j.filters.company_types || [],
                job_types: j.filters.job_types || [],
                cohort: j.filters.cohort || "",
              });
            }
          }
        });
      }
    });
  }, []);

  function toggle(arr: string[], v: string): string[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  async function savePersonalSub() {
    if (!user) return;
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token;
      if (!t) return;
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ filters }),
      });
      if (res.ok) {
        const j = await res.json();
        setMySub(j.url);
      } else {
        const e = await res.json().catch(() => ({}));
        alert("生成失败：" + (e.error || res.status));
      }
    } finally {
      setSaving(false);
    }
  }

  function copyText(s: string) {
    navigator.clipboard.writeText(s).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // 加入/移出待投看板：未登录存本地 localStorage，登录后同步 user_jobs（与首页一致）
  async function toggleBoard(e: React.MouseEvent, jobId: string) {
    e.preventDefault();
    e.stopPropagation();
    const had = !!boards[jobId];
    const next = { ...boards };
    if (had) delete next[jobId];
    else next[jobId] = "待投";
    setBoards(next);
    showToast(had ? "已从看板移除" : "已加入待投看板");
    localStorage.setItem("offer_board", JSON.stringify(next));
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (uid) {
      if (had) {
        await supabase.from("user_jobs").delete().eq("user_id", uid).eq("job_id", jobId).eq("status", "pending");
      } else {
        await supabase.from("user_jobs").upsert(
          { user_id: uid, job_id: jobId, status: "pending" },
          { onConflict: "user_id,job_id,status" }
        );
      }
    }
  }

  function copyUrl() {
    if (!subUrl) return;
    copyText(subUrl);
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
      "X-WR-CALNAME:Offer派 校招截止提醒",
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
            <span className="sub-label">公共订阅 URL（全岗位，手机日历填这个）</span>
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
            <p><b>安卓（OPPO/华为/小米）：</b>日历 App → 日程同步与导入 → 通过 URL 导入 → 粘贴 URL（其他品牌入口名称略有差异，核心是"通过 URL 导入/订阅"）</p>
            <p style={{ color: "rgba(183,198,194,.55)" }}>URL 订阅后会自动同步新岗位；如粘贴后提示无法连接，请确认复制的是完整 https 地址。</p>
          </div>

          <div style={{ borderTop: "1px solid rgba(183,198,194,.15)", marginTop: 14, paddingTop: 14 }}>
            <div className="sub-label" style={{ fontWeight: 700, marginBottom: 8 }}>
              个性化订阅（仅推送你筛选的岗位）
            </div>
            {!user ? (
              <p style={{ color: "rgba(183,198,194,.7)", fontSize: 12.5 }}>
                登录后可配置筛选条件，生成专属订阅 URL。
              </p>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                  <div>
                    <span style={{ color: "rgba(183,198,194,.7)", marginRight: 6 }}>城市</span>
                    <CityFilterPanel
                      opts={cityOpts}
                      value={filters.cities}
                      onChange={(next) => setFilters((f) => ({ ...f, cities: next }))}
                    />
                  </div>
                  <div>
                    <span style={{ color: "rgba(183,198,194,.7)", marginRight: 6 }}>行业</span>
                    <span className="chip-row">
                      {industryOpts.map((o) => (
                        <button
                          key={o.v}
                          className={"chip" + (filters.industries.includes(o.v) ? " on" : "")}
                          onClick={() => setFilters((f) => ({ ...f, industries: toggle(f.industries, o.v) }))}
                        >
                          {o.v}
                          {o.n > 0 && <em className="chip-n">{o.n}</em>}
                        </button>
                      ))}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(183,198,194,.7)", marginRight: 6 }}>公司性质</span>
                    <span className="chip-row">
                      {companyTypeOpts.map((o) => (
                        <button
                          key={o.v}
                          className={"chip" + (filters.company_types.includes(o.v) ? " on" : "")}
                          onClick={() => setFilters((f) => ({ ...f, company_types: toggle(f.company_types, o.v) }))}
                        >
                          {o.v}
                          {o.n > 0 && <em className="chip-n">{o.n}</em>}
                        </button>
                      ))}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(183,198,194,.7)", marginRight: 6 }}>类型</span>
                    <span className="chip-row">
                      {JOB_TYPES.map((t) => (
                        <button
                          key={t}
                          className={"chip" + (filters.job_types.includes(t) ? " on" : "")}
                          onClick={() => setFilters((f) => ({ ...f, job_types: toggle(f.job_types, t) }))}
                        >
                          {t}
                        </button>
                      ))}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(183,198,194,.7)", marginRight: 6 }}>届别</span>
                    <select
                      className="chip-select"
                      value={filters.cohort}
                      onChange={(e) => setFilters((f) => ({ ...f, cohort: e.target.value }))}
                    >
                      <option value="">不限</option>
                      {cohortOpts.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="sub-actions" style={{ marginTop: 10 }}>
                  <button className="sub-btn" onClick={savePersonalSub} disabled={saving}>
                    {saving ? "生成中…" : mySub ? "更新我的订阅 URL" : "生成个性化订阅 URL"}
                  </button>
                  {mySub && (
                    <button className="sub-btn" onClick={() => copyText(mySub)}>
                      复制我的订阅 URL
                    </button>
                  )}
                </div>
                {mySub && (
                  <div className="sub-row" style={{ marginTop: 8 }}>
                    <code className="sub-url" style={{ fontSize: 11 }}>{mySub}</code>
                  </div>
                )}
              </>
            )}
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
                <div key={j.id} className="dl-item">
                  <a className="dl-main" href={j.applyUrl} target="_blank" rel="noopener noreferrer">
                    <span className="ic" style={{ background: j.bg }}>
                      {j.lg}
                    </span>
                    <div>
                      <div className="tt">{j.title}</div>
                      <div className="cp">
                        {j.company} · {j.city} · {j.jobType} · {j.cohort || "届别未标注"}
                      </div>
                    </div>
                  </a>
                  <div className="dl-ops">
                    <button
                      className={"dl-board" + (boards[j.id] ? " on" : "")}
                      onClick={(e) => toggleBoard(e, j.id)}
                    >
                      {boards[j.id] ? "已加入" : "加入待投"}
                    </button>
                    <a className="go" href={j.applyUrl} target="_blank" rel="noopener noreferrer">
                      官方投递
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path d="M7 17 17 7M9 7h8v8" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
