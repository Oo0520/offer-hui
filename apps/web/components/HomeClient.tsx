"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEGREE_FILTER_LEVEL,
  JobView,
  SortMode,
  degreeLevel,
  dimOptions,
  sortJobsBy,
} from "@/lib/jobs";
import JobCard from "./JobCard";
import JobTable from "./JobTable";
import CityFilterPanel from "./CityFilterPanel";
import { cityOptions, SOURCE_NAME } from "@/lib/jobs";
import { supabase } from "@/lib/supabase";
import { DEADLINE_BUCKETS, matchDeadlineBucket, JOB_TYPES } from "@/lib/taxonomy";
import { parseQuery, mergeParsed } from "@/lib/queryParser";


export type HomeStats = {
  total: number;
  companies: number;
  due30: number;
};

// 面板常驻维度：按「只留必须项」收敛为 4 项 + 1 个上下文维度（学校仅在活动类出现）。
// 其余维度（行业 / 公司性质 / 届别）不再占面板，改由顶部复合搜索承担。
type Dim = "city" | "industry" | "companyType" | "jobType" | "cohort" | "degree" | "school" | "deadline";
type FState = Record<Dim, string[]>;

const DIMS: { key: Dim; label: string; contextual?: "event" }[] = [
  { key: "jobType", label: "招聘类型" },
  { key: "city", label: "城市" },
  { key: "degree", label: "学历" },
  { key: "deadline", label: "截止时间" },
  { key: "school", label: "学校", contextual: "event" },
];

// 复合搜索可回显的条件标签（含面板不展示、仅由搜索产生的维度）
const PARSED_FIELD_LABEL: Record<string, string> = {
  jobType: "招聘类型",
  city: "城市",
  degree: "学历",
  deadline: "截止",
  cohort: "届别",
  industry: "行业",
  companyType: "公司性质",
  school: "学校",
};

const DEADLINE_LABEL: Record<string, string> = Object.fromEntries(
  DEADLINE_BUCKETS.map((b) => [b.key, b.label]),
);

export default function HomeClient({
  jobs,
  stats,
}: {
  jobs: JobView[];
  stats: HomeStats;
}) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<FState>({
    city: [],
    industry: [],
    companyType: [],
    jobType: [],
    cohort: [],
    degree: [],
    school: [],
    deadline: [],
  });
  const [openDim, setOpenDim] = useState<Dim | null>(null);
  const [view, setView] = useState<"card" | "table">("card");
  const [sortMode, setSortMode] = useState<SortMode>("deadline");
  const [showToday, setShowToday] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showBackTop, setShowBackTop] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }
  const PAGE_SIZE = 12;
  const fgRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 用户岗位状态：favs = 收藏的 jobId 集合, boards = { jobId: 状态 }
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [boards, setBoards] = useState<Record<string, string>>({});

  // 顶部导航搜索跳转 /?q=...，这里接住并复用同一解析器
  // （此前全站没有任何路由读取 searchParams，导致顶部搜索点了等于没搜）
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (!initial) return;
    const p = parseQuery(initial);
    setFilters((prev) => mergeParsed(prev, p.filters));
    setQ(p.keyword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 已在首页时，Nav 通过事件投递搜索词（router.push 同路由不会重挂载本组件）
  useEffect(() => {
    const onSearch = (e: Event) => {
      const v = (e as CustomEvent<string>).detail || "";
      if (!v) return;
      const p = parseQuery(v);
      setFilters((prev) => mergeParsed(prev, p.filters));
      setQ(p.keyword);
      setCurrentPage(1);
    };
    window.addEventListener("offer-search", onSearch as EventListener);
    return () => window.removeEventListener("offer-search", onSearch as EventListener);
  }, []);

  // 初始化：从 localStorage 读，再从数据库同步
  useEffect(() => {
    // 先读 localStorage
    try {
      const localFavs = JSON.parse(localStorage.getItem("offer_fav") || "[]");
      const localBoards = JSON.parse(localStorage.getItem("offer_board") || "{}");
      setFavs(new Set(localFavs));
      setBoards(localBoards);
    } catch {}

    // 登录后：先把 localStorage 的未同步数据上传，再从数据库读
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user;
      if (!u) return;

      // localStorage 的数据
      const localFavs = new Set(JSON.parse(localStorage.getItem("offer_fav") || "[]"));
      const localBoards = JSON.parse(localStorage.getItem("offer_board") || "{}");

      // 数据库已有的
      const { data: existing } = await supabase
        .from("user_jobs")
        .select("job_id, status")
        .eq("user_id", u.id);
      const existingMap = new Set((existing || []).map((r) => r.job_id + "_" + r.status));

      // 上传 localStorage 有但数据库没有的
      for (const jobId of localFavs) {
        if (!existingMap.has(jobId + "_star")) {
          await supabase.from("user_jobs").upsert(
            { user_id: u.id, job_id: jobId, status: "star" },
            { onConflict: "user_id,job_id,status" }
          );
        }
      }
      for (const [jobId, stage] of Object.entries(localBoards)) {
        if (!existingMap.has(jobId + "_pending")) {
          await supabase.from("user_jobs").upsert(
            { user_id: u.id, job_id: jobId, status: "pending" },
            { onConflict: "user_id,job_id,status" }
          );
        }
      }

      // 再从数据库读全部
      supabase
        .from("user_jobs")
        .select("job_id, status")
        .eq("user_id", u.id)
        .then(({ data: rows, error }) => {
          if (error || !rows) return;
          const f = new Set<string>();
          const b: Record<string, string> = {};
          for (const r of rows) {
            if (r.status === "star") f.add(r.job_id);
            else if (r.status === "pending") b[r.job_id] = "待投";
          }
          setFavs(f);
          setBoards(b);
        });
    });

    // 监听登录状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) return;
      supabase
        .from("user_jobs")
        .select("job_id, status")
        .eq("user_id", session.user.id)
        .then(({ data: rows }) => {
          if (!rows) return;
          const f = new Set<string>();
          const b: Record<string, string> = {};
          for (const r of rows) {
            if (r.status === "star") f.add(r.job_id);
            else if (r.status === "pending") b[r.job_id] = "待投";
          }
          setFavs(f);
          setBoards(b);
        });
    });
    return () => subscription.unsubscribe();
  }, []);

  async function toggleFav(e: React.MouseEvent, jobId: string) {
    e.preventDefault();
    e.stopPropagation();
    const on = !favs.has(jobId);
    const newFavs = new Set(favs);
    if (on) newFavs.add(jobId); else newFavs.delete(jobId);
    setFavs(newFavs);
    showToast(on ? "已收藏" : "已取消收藏");
    // localStorage
    localStorage.setItem("offer_fav", JSON.stringify([...newFavs]));
    // 数据库
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      if (on) {
        await supabase.from("user_jobs").upsert({
          user_id: session.user.id, job_id: jobId, status: "star",
        }, { onConflict: "user_id,job_id,status" });
      } else {
        await supabase.from("user_jobs").delete()
          .eq("user_id", session.user.id).eq("job_id", jobId).eq("status", "star");
      }
    }
  }

  async function toggleBoard(e: React.MouseEvent, jobId: string) {
    e.preventDefault();
    e.stopPropagation();
    const newBoards = { ...boards };
    const had = !!newBoards[jobId];
    if (had) delete newBoards[jobId];
    else newBoards[jobId] = "待投";
    setBoards(newBoards);
    showToast(had ? "已从看板移除" : "已加入待投看板");
    localStorage.setItem("offer_board", JSON.stringify(newBoards));
    // 数据库
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      if (newBoards[jobId]) {
        await supabase.from("user_jobs").upsert({
          user_id: session.user.id, job_id: jobId, status: "pending",
        }, { onConflict: "user_id,job_id,status" });
      } else {
        await supabase.from("user_jobs").delete()
          .eq("user_id", session.user.id).eq("job_id", jobId).eq("status", "pending");
      }
    }
  }

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
      companyType: [],
      jobType: [],
      cohort: [],
      degree: [],
      school: [],
      deadline: [],
    };
    // 招聘类型：本站内容形态 5 类（含此前遗漏的「招聘公告」）
    m.jobType = JOB_TYPES.map((v) => ({
      v,
      n: jobs.filter((j) => j.jobType === v).length,
    }));
    // 城市：标准城市树 + 计数
    m.city = cityOptions(jobs);
    // 学历：「我的学历」三档，计数按向下兼容语义（岗位要求层级 ≤ 我的层级）
    m.degree = dimOptions(jobs, "degree").map((v) => ({
      v,
      n: jobs.filter((j) => degreeLevel(j.degree) <= (DEGREE_FILTER_LEVEL[v] ?? 0)).length,
    }));
    // 截止时间：分档
    m.deadline = DEADLINE_BUCKETS.map((b) => ({
      v: b.key,
      n: jobs.filter((j) => matchDeadlineBucket(j.deadlineDays, b.key)).length,
    }));
    // 学校：仅从招聘会/宣讲会提取（活动类才有「举办学校」语义）
    const m2 = new Map<string, number>();
    for (const j of jobs) {
      if (!j.source) continue;
      if (j.jobType !== "招聘会" && j.jobType !== "宣讲会") continue;
      m2.set(j.source, (m2.get(j.source) || 0) + 1);
    }
    m.school = [...m2.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ v, n }));
    return m;
  }, [jobs]);

  // 复合搜索：解析预览（输入即时可见，Enter 才提交条件）
  const parsed = useMemo(() => parseQuery(q), [q]);

  const list = useMemo(() => {
    let l = jobs;
    const f = (k: Dim) => filters[k];
    if (f("jobType").length) l = l.filter((j) => f("jobType").includes(j.jobType));
    if (f("city").length) l = l.filter((j) => f("city").includes(j.city));
    if (f("industry").length) l = l.filter((j) => f("industry").includes(j.industry));
    if (f("companyType").length) l = l.filter((j) => f("companyType").includes(j.companyType));
    if (f("cohort").length) l = l.filter((j) => f("cohort").includes(j.cohort));
    if (f("school").length) l = l.filter((j) => f("school").some((s) => s && j.source.includes(s)));
    if (f("deadline").length) l = l.filter((j) => f("deadline").some((k) => matchDeadlineBucket(j.deadlineDays, k)));
    if (f("degree").length) {
      // 向下兼容：多选时取最高学历作为我的学历，显示岗位要求层级 <= 我的层级
      const myLevel = Math.max(...f("degree").map((d) => DEGREE_FILTER_LEVEL[d] ?? 0));
      l = l.filter((j) => degreeLevel(j.degree) <= myLevel);
    }
    if (q.trim()) {
      const ql = q.trim().toLowerCase();
      l = l.filter((j) =>
        (j.title + j.company + j.city + j.industry).toLowerCase().includes(ql)
      );
    }
    return sortJobsBy(l, sortMode);
  }, [jobs, filters, q, sortMode]);

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

  // 提交复合搜索：解析出的条件并入筛选面板（同一份 state），
  // 输入框只保留未识别的关键词——避免「搜索」与「面板」两套条件互相矛盾。
  function commitQuery() {
    const p = parseQuery(q);
    setFilters((prev) => mergeParsed(prev, p.filters));
    setQ(p.keyword);
    setCurrentPage(1);
  }

  function removeCondition(field: Dim, value: string) {
    setFilters((prev) => ({ ...prev, [field]: prev[field].filter((v) => v !== value) }));
    setCurrentPage(1);
  }

  // 已生效条件（含面板不展示、仅由搜索产生的行业/公司性质/届别），供 chip 回显与逐个移除
  const activeConds = useMemo(() => {
    const label = (field: Dim, v: string) =>
      field === "deadline"
        ? DEADLINE_LABEL[v] ?? v
        : field === "school"
          ? SOURCE_NAME[v] ?? v
          : v;
    const keys: Dim[] = ["jobType", "city", "degree", "deadline", "school", "cohort", "industry", "companyType"];
    const out: { field: Dim; value: string; label: string }[] = [];
    for (const k of keys) {
      for (const v of filters[k]) out.push({ field: k, value: v, label: label(k, v) });
    }
    return out;
  }, [filters]);

  const activeCount = activeConds.length;

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
            onKeyDown={(e) => e.key === "Enter" && commitQuery()}
            placeholder="复合搜索：福州 实习 本科 15K以上 本周"
          />
          <div className="orbital">
            <button className="inner sm" onClick={commitQuery}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
              搜索
            </button>
          </div>
        </div>

        {/* 复合搜索预览：输入即时识别，Enter 才提交（不静默猜） */}
        {q.trim() && parsed.tokens.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginTop: "10px", fontSize: "12px", color: "rgba(183,198,194,.75)" }}>
            <span>将识别为</span>
            {parsed.tokens.map((t) => (
              <span key={t.raw} style={{ padding: "2px 8px", borderRadius: "999px", border: "1px solid rgba(183,198,194,.28)" }}>
                <b style={{ fontWeight: 700, marginRight: "4px" }}>{PARSED_FIELD_LABEL[t.field] ?? "关键词"}</b>
                {t.label}
              </span>
            ))}
            {parsed.keyword &&
              !parsed.tokens.some((t) => t.field === "keyword" && t.value === parsed.keyword) && (
                <span style={{ padding: "2px 8px", borderRadius: "999px", border: "1px solid rgba(183,198,194,.28)" }}>
                  <b style={{ fontWeight: 700, marginRight: "4px" }}>关键词</b>
                  {parsed.keyword}
                </span>
              )}
          </div>
        )}

        {/* 已生效条件：可逐个移除，避免"面板没显示但结果被筛掉" */}
        {activeConds.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginTop: "10px", fontSize: "12px" }}>
            {activeConds.map((c) => (
              <button
                key={c.field + ":" + c.value}
                onClick={() => removeCondition(c.field, c.value)}
                style={{
                  padding: "3px 9px",
                  borderRadius: "999px",
                  border: "1px solid rgba(202,0,19,.5)",
                  background: "transparent",
                  color: "#fda4af",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {PARSED_FIELD_LABEL[c.field] ?? c.field}：{c.label} <span style={{ opacity: 0.7 }}>×</span>
              </button>
            ))}
          </div>
        )}
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

      {/* ===== 筛选（只留必须项；类型不再与顶部 chip 重复） ===== */}
      <div className="toolbar">
        <div className="filter-group" ref={fgRef}>
          {dims
            .filter((d) => {
              // 学校只在「活动类」（宣讲会/招聘会）语境下出现——此时才有"举办学校"语义
              if (d.key === "school")
                return filters.jobType.some((t) => t === "招聘会" || t === "宣讲会");
              return true;
            })
            .map((d) => (
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
                setFilters({ city: [], industry: [], companyType: [], jobType: [], cohort: [], degree: [], school: [], deadline: [] })
              }
            >
              清除
            </button>
          )}
          <div className={"filter-panel" + (openDim ? " open" : "")}>
            {openDim && <FilterOptions dim={openDim} opts={dimOpts[openDim]} filters={filters} toggleDim={toggleDim} clearDim={clearDim} setCurrentPage={setCurrentPage} onCityChange={(next) => { setFilters((f) => ({ ...f, city: next })); setCurrentPage(1); }} />}
          </div>
        </div>
      </div>

      {/* 筛选遮罩层 */}
      <div
        className={"filter-mask" + (openDim ? " open" : "")}
        onClick={() => setOpenDim(null)}
      />

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
              <p>试试更换筛选条件，或减少复合搜索里的词</p>
              <button
                onClick={() => {
                  setQ("");
                  setFilters({ city: [], industry: [], companyType: [], jobType: [], cohort: [], degree: [], school: [], deadline: [] });
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
                  <JobCard
                    key={j.id}
                    job={j}
                    fav={favs.has(j.id)}
                    board={boards[j.id] || null}
                    onToggleFav={(e) => toggleFav(e, j.id)}
                    onToggleBoard={(e) => toggleBoard(e, j.id)}
                  />
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
      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
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

function FilterOptions({
  dim,
  opts,
  filters,
  toggleDim,
  clearDim,
  setCurrentPage,
  onCityChange,
}: {
  dim: Dim;
  opts: { v: string; n: number }[];
  filters: FState;
  toggleDim: (d: Dim, v: string) => void;
  clearDim: (d: Dim) => void;
  setCurrentPage: (n: number) => void;
  onCityChange: (next: string[]) => void;
}) {
  const renderOpt = (o: { v: string; n: number }) => (
    <div
      key={o.v}
      className={"f-opt" + (filters[dim].includes(o.v) ? " on" : "")}
      onClick={() => {
        toggleDim(dim, o.v);
        setCurrentPage(1);
      }}
    >
      <span className="cb">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
          <path d="m5 12 4 4L19 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {dim === "school"
        ? SOURCE_NAME[o.v] || o.v
        : dim === "deadline"
          ? DEADLINE_LABEL[o.v] ?? o.v
          : o.v}
      <span className="n">{o.n}</span>
    </div>
  );

// 城市筛选：三级联动面板（全国/热门 + 省份两级）
  if (dim === "city") {
    return (
      <>
        <CityFilterPanel
          opts={opts}
          value={filters.city}
          onChange={onCityChange}
        />
        {filters[dim].length > 0 && (
          <button className="f-clear" onClick={() => clearDim(dim)}>清空该维度</button>
        )}
      </>
    );
  }

  // 其他维度不分组
  return (
    <>
      {opts.map(renderOpt)}
      {filters[dim].length > 0 && (
        <button className="f-clear" onClick={() => clearDim(dim)}>清空该维度</button>
      )}
    </>
  );
}
