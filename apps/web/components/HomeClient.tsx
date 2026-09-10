"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEGREE_FILTER_LEVEL,
  JobView,
  SortMode,
  degreeLevel,
  dimOptions,
  sortJobsBy,
  toView,
} from "@/lib/jobs";
import JobCard from "./JobCard";
import JobTable from "./JobTable";


export type HomeStats = {
  total: number;
  companies: number;
  due30: number;
};

type Dim = "city" | "industry" | "jobType" | "cohort" | "degree";
type FState = Record<Dim, string[]>;

const DIMS: { key: Dim; label: string }[] = [
  { key: "city", label: "城市" },
  { key: "industry", label: "行业" },
  { key: "jobType", label: "招聘类型" },
  { key: "cohort", label: "届别" },
  { key: "degree", label: "学历" },
];

const CHIPS = [
  { key: "all", label: "全部" },
  { key: "校招", label: "校招" },
  { key: "实习", label: "实习" },
  { key: "招聘会", label: "招聘会" },
  { key: "urgent", label: "30天内截止" },
];

export default function HomeClient({
  jobs,
  stats,
}: {
  jobs: JobView[];
  stats: HomeStats;
}) {
  const [chip, setChip] = useState("all");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<FState>({
    city: [],
    industry: [],
    jobType: [],
    cohort: [],
    degree: [],
  });
  const [openDim, setOpenDim] = useState<Dim | null>(null);
  const [view, setView] = useState<"card" | "table">("card");
  const [sortMode, setSortMode] = useState<SortMode>("deadline");
  const [showToday, setShowToday] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showBackTop, setShowBackTop] = useState(false);
  const PAGE_SIZE = 12;
  const fgRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const nowQ = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") : null;
  useEffect(() => {
    if (nowQ) setQ(nowQ);
  }, [nowQ]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (fgRef.current && !fgRef.current.contains(e.target as Node)) setOpenDim(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    function onScroll() {
      setShowBackTop(window.scrollY > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dimOpts = useMemo(() => {
    const m: Record<Dim, { v: string; n: number }[]> = {
      city: [],
      industry: [],
      jobType: [],
      cohort: [],
      degree: [],
    };
    for (const d of DIMS) {
      m[d.key] = dimOptions(jobs, d.key as "city").map((v) => ({
        v,
        n:
          d.key === "degree"
            ? v === "不限"
              ? jobs.filter((j) => degreeLevel(j.degree) === 0).length
              : jobs.filter((j) => degreeLevel(j.degree) >= (DEGREE_FILTER_LEVEL[v] ?? 0)).length
            : jobs.filter((j) => j[d.key] === v).length,
      }));
    }
    // 招聘类型固定三项
    m.jobType = [
      { v: "校招", n: jobs.filter((j) => j.jobType === "校招").length },
      { v: "实习", n: jobs.filter((j) => j.jobType === "实习").length },
      { v: "招聘会", n: jobs.filter((j) => j.jobType === "招聘会").length },
    ];
    return m;
  }, [jobs]);

  const list = useMemo(() => {
    let l = jobs;
    const f = (k: Dim) => filters[k];
    if (f("jobType").length) l = l.filter((j) => f("jobType").includes(j.jobType));
    if (f("city").length) l = l.filter((j) => f("city").includes(j.city));
    if (f("industry").length) l = l.filter((j) => f("industry").includes(j.industry));
    if (f("cohort").length) l = l.filter((j) => f("cohort").includes(j.cohort));
    if (f("degree").length) {
      const minLevel = Math.min(...f("degree").map((d) => DEGREE_FILTER_LEVEL[d] ?? 0));
      l = l.filter((j) => degreeLevel(j.degree) >= minLevel);
    }
    if (chip === "校招") l = l.filter((j) => j.jobType === "校招");
    if (chip === "实习") l = l.filter((j) => j.jobType === "实习");
    if (chip === "招聘会") l = l.filter((j) => j.jobType === "招聘会");
    if (chip === "urgent")
      l = l.filter((j) => j.deadlineDays !== null && j.deadlineDays >= 0 && j.deadlineDays <= 30);
    if (q.trim()) {
      const ql = q.trim().toLowerCase();
      l = l.filter((j) =>
        (j.title + j.company + j.city + j.industry).toLowerCase().includes(ql)
      );
    }
    return sortJobsBy(l, sortMode);
  }, [jobs, filters, chip, q, sortMode]);

  const todayJobs = useMemo(
    () => jobs.filter((j) => j.deadlineDays === 0).sort((a, b) => (a.deadlineAt || "").localeCompare(b.deadlineAt || "")),
    [jobs]
  );
  const dueSoon = useMemo(
    () =>
      jobs
        .filter((j) => j.deadlineDays !== null && j.deadlineDays >= 0 && j.deadlineDays <= 30)
        .sort((a, b) => (a.deadlineDays || 0) - (b.deadlineDays || 0)),
    [jobs]
  );

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const shown = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const dims = DIMS;

  function toggleDim(d: Dim, v: string) {
    setFilters((prev) => {
      const cur = prev[d];
      if (v === "不限") return { ...prev, [d]: [] };
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      return { ...prev, [d]: next.filter((x) => x !== "不限") };
    });
  }

  function clearDim(d: Dim) {
    setFilters((prev) => ({ ...prev, [d]: [] }));
  }

  const activeCount = DIMS.reduce((n, d) => n + filters[d.key].length, 0);

  return (
    <div className="wrap">
      {/* ===== Hero ===== */}
      <div className="hero">
        <span className="label">2026 秋招季 · 信息聚合</span>
        <h1 className="h-display">
          秋招信息
          <br />
          一站汇聚
        </h1>
        <p className="sub">
          聚合国家 24365 平台与高校就业网的校招 / 实习信息，全部跳转官方投递入口，不截留简历。
        </p>
        <div className="hero-tags">
          <span>2026 秋招季</span>
          <span>{stats.companies}+ 家招聘单位</span>
          <span>校招 + 实习</span>
          <span>截止提醒</span>
          <span>官方直投</span>
        </div>
        <div className="hero-search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setCurrentPage(1)}
            placeholder="搜索公司 / 岗位 / 行业"
          />
          <div className="orbital">
            <button className="inner sm" onClick={() => setCurrentPage(1)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
              搜索
            </button>
          </div>
        </div>
        <div className="hero-stats">
          <div className="st glass">
            <b>{stats.total}</b>
            <span>聚合岗位</span>
          </div>
          <div className="st glass">
            <b>{stats.companies}</b>
            <span>招聘企业</span>
          </div>
          <div className="st glass">
            <b>{stats.due30}</b>
            <span>30天内截止</span>
          </div>
        </div>
      </div>

      {/* ===== 快捷标签 + 筛选 ===== */}
      <div className="toolbar">
        <div className="chips">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              className={chip === c.key ? "on" : ""}
              onClick={() => {
                setChip(c.key);
                setCurrentPage(1);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="filter-group" ref={fgRef}>
          {dims.map((d) => (
            <button
              key={d.key}
              className={"filter-btn" + (openDim === d.key ? " open" : "")}
              onClick={() => setOpenDim(openDim === d.key ? null : d.key)}
            >
              {d.label}
              {filters[d.key].length ? `(${filters[d.key].length})` : ""}
              <span className="arr">
                <svg width="9" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          ))}
          {activeCount > 0 && (
            <button
              className="filter-btn"
              style={{ borderColor: "rgba(202,0,19,.5)", color: "#fda4af" }}
              onClick={() =>
                setFilters({ city: [], industry: [], jobType: [], cohort: [], degree: [] })
              }
            >
              清除
            </button>
          )}
          <div
            className={"filter-mask" + (openDim ? " open" : "")}
            onClick={() => setOpenDim(null)}
          />
          <div className={"filter-panel" + (openDim ? " open" : "")}>
            {openDim &&
              dimOpts[openDim].map((o) => (
                <div
                  key={o.v}
                  className={"f-opt" + (filters[openDim].includes(o.v) ? " on" : "")}
                  onClick={() => {
                    toggleDim(openDim, o.v);
                    setCurrentPage(1);
                  }}
                >
                  <span className="cb">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                      <path d="m5 12 4 4L19 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {o.v}
                  <span className="n">{o.n}</span>
                </div>
              ))}
            {openDim && filters[openDim].length > 0 && (
              <button className="f-clear" onClick={() => clearDim(openDim)}>
                清空该维度
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== 主体 ===== */}
      <div className="main">
        <div className="col">
          {/* 今日截止（默认折叠，点击展开） */}
          <div
            className="today-fold glass"
            onClick={() => setShowToday(!showToday)}
            role="button"
            tabIndex={0}
          >
            <span className="tf-dot"></span>
            <span className="tf-title">今日截止</span>
            <span className="cnt">{todayJobs.length} 个岗位</span>
            <span className={"tf-arrow " + (showToday ? "open" : "")}>›</span>
          </div>
          {showToday &&
            (todayJobs.length === 0 ? (
              <div className="empty glass">
                <div className="e-ic">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="#8b5cf6" strokeWidth="2" />
                    <path d="M12 8v5M12 16.5v.5" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <h3>今天暂时没有到期的岗位</h3>
                <p>去看看 30 天内即将截止的机会，别错过投递窗口</p>
              </div>
            ) : (
              <div className="today-grid">
                {todayJobs.map((j) => (
                  <a
                    key={j.id}
                    className="today-card"
                    href={j.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="lg" style={{ background: j.bg }}>
                      {j.lg}
                    </span>
                    <div className="bd">
                      <h4>{j.title}</h4>
                      <p>
                        {j.company} · 截止 {j.deadlineAt} · {j.city}
                      </p>
                    </div>
                    <span className="lg-t">今天截止</span>
                  </a>
                ))}
              </div>
            ))}

          {/* 岗位列表 */}
          <div className="sec-head" style={{ marginTop: 24 }}>
            <h2>岗位列表</h2>
            <span className="cnt">{list.length} 个岗位</span>
            <div className="view-toggle sort-toggle">
              <button className={sortMode === "deadline" ? "on" : ""} onClick={() => setSortMode("deadline")}>
                截止最近
              </button>
              <button className={sortMode === "newest" ? "on" : ""} onClick={() => setSortMode("newest")}>
                最新发布
              </button>
              <button className={sortMode === "salary" ? "on" : ""} onClick={() => setSortMode("salary")}>
                薪资最高
              </button>
            </div>
            <div className="view-toggle">
              <button className={view === "card" ? "on" : ""} onClick={() => setView("card")}>
                卡片
              </button>
              <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}>
                表格
              </button>
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="empty glass">
              <div className="e-ic">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="#8b5cf6" strokeWidth="2" />
                  <path d="m20 20-3.5-3.5" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3>没有匹配的岗位</h3>
              <p>试试更换标签或清除筛选条件</p>
              <button
                onClick={() => {
                  setChip("all");
                  setQ("");
                  setFilters({ city: [], industry: [], jobType: [], cohort: [], degree: [] });
                  setCurrentPage(1);
                }}
              >
                清除筛选
              </button>
            </div>
          ) : (
            <>
              <div
                className="job-grid"
                ref={listRef}
                style={{ display: view === "card" ? "grid" : "none" }}
              >
                {shown.map((j) => (
                  <JobCard key={j.id} job={j} />
                ))}
              </div>
              <div className={"table-wrap" + (view === "table" ? " on" : "")}>
                <JobTable jobs={shown} />
              </div>
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pg-btn"
                    disabled={safePage === 1}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 7) return true;
                      if (p <= 2 || p >= totalPages - 1) return true;
                      if (Math.abs(p - safePage) <= 1) return true;
                      return false;
                    })
                    .map((p, idx, arr) => (
                      <span key={p} className="pg-wrap">
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="pg-dots">…</span>}
                        <button
                          className={"pg-num" + (p === safePage ? " on" : "")}
                          onClick={() => {
                            setCurrentPage(p);
                            listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                  <button
                    className="pg-btn"
                    disabled={safePage === totalPages}
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    ›
                  </button>
                  <span className="pg-info">
                    第 {safePage} / {totalPages} 页
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* 侧栏 */}
        <aside className="side">
          <div className="panel glass">
            <h4>
              <span className="dot"></span>近期截止 Top 6
            </h4>
            {dueSoon.length === 0 ? (
              <p style={{ fontSize: 12, color: "rgba(183,198,194,.6)" }}>
                未来 30 天暂无标注截止的岗位
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {dueSoon.slice(0, 6).map((j) => (
                  <a
                    key={j.id}
                    href={j.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 10px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,.03)",
                      border: "1px solid rgba(183,198,194,.12)",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 9,
                        background: j.bg,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 12,
                        flex: "none",
                      }}
                    >
                      {j.lg}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {j.title}
                      </span>
                      <span style={{ display: "block", fontSize: 10.5, color: "rgba(183,198,194,.6)" }}>
                        {j.company} · {j.city}
                      </span>
                    </span>
                    <span
                      style={{
                        flex: "none",
                        fontSize: 10.5,
                        fontWeight: 900,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: j.deadlineDays !== null && j.deadlineDays <= 3 ? "rgba(202,0,19,.2)" : "rgba(139,92,246,.16)",
                        color: j.deadlineDays !== null && j.deadlineDays <= 3 ? "#fda4af" : "#c4b5fd",
                      }}
                    >
                      {j.deadlineDays === 0 ? "今天" : `${j.deadlineDays}天`}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="panel glass">
            <h4>
              <span className="dot"></span>数据来源
            </h4>
            <p style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="badge">国家 24365 平台</span>
              <span className="badge">福建就业网</span>
              <span className="badge">福建人才联合网</span>
              <span className="badge">福建理工大学就业网</span>
            </p>
            <p style={{ marginTop: 10, fontSize: 11.5, color: "rgba(183,198,194,.55)" }}>
              所有岗位均标注来源并跳转官方投递入口，本站不截留简历、不收集投递信息。
            </p>
          </div>
        </aside>
      </div>

      {/* 回到顶部 */}
      <button
        className={"back-to-top" + (showBackTop ? " show" : "")}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="回到顶部"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 19V5M5 12l7-7 7 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
