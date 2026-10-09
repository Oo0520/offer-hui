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
import { cityOptions, industryOptions, companyTypeOptions, SOURCE_NAME } from "@/lib/jobs";
import { supabase } from "@/lib/supabase";
import {
  DEADLINE_BUCKETS,
  matchDeadlineBucket,
  JOB_TYPES,
  COHORT_OPTIONS,
  COHORT_ANY,
} from "@/lib/taxonomy";
import { parseQuery, mergeParsed } from "@/lib/queryParser";


export type HomeStats = {
  total: number;
  companies: number;
  due30: number;
};

// 面板维度：「招聘类型」不在此列——它由顶部 chip 单选承担（两者相互独立，不共用 state）。
// 「学校」只在活动类（宣讲会/招聘会）语境下出现——此时才有"举办学校"语义。
// jobType 键保留在 FState 里仅为兼容复合搜索的合并结构，恒为空数组（类型只走 chip）。
type Dim = "city" | "industry" | "companyType" | "jobType" | "cohort" | "degree" | "school" | "deadline";
type FState = Record<Dim, string[]>;

const DIMS: { key: Dim; label: string }[] = [
  { key: "city", label: "城市" },
  { key: "industry", label: "行业" },
  { key: "companyType", label: "公司性质" },
  { key: "cohort", label: "届别" },
  { key: "degree", label: "学历" },
  { key: "deadline", label: "截止时间" },
  { key: "school", label: "学校" },
];

// 各招聘类型下**适用**的面板维度（用户明确要求）：
//   - 城市/行业/公司性质/届别/学历/截止时间 只对「校招/实习」有语义
//   - 活动类（宣讲会/招聘会）只保留「学校」——此时才有"举办学校"语义
//   - 「招聘公告」无可用维度
// 不适用的维度：不显示、也不参与过滤（值保留，切回校招/实习时恢复）
const PANEL_DIMS: Dim[] = ["city", "industry", "companyType", "cohort", "degree", "deadline", "school"];
const APPLICABLE_BY_TYPE: Record<string, Dim[]> = {
  "": PANEL_DIMS.filter((d) => d !== "school"),
  校招: PANEL_DIMS.filter((d) => d !== "school"),
  实习: PANEL_DIMS.filter((d) => d !== "school"),
  宣讲会: ["school"],
  招聘会: ["school"],
  招聘公告: [],
};

// 顶部快捷区：5 个固定招聘类型。
// 规则（用户明确要求）：
//   - 单选：同时只能有一个生效；再点同一个即取消（回到"不限类型"）
//   - 无「全部」项
//   - 与面板相互独立：chip 不参与 activeCount，故点完 chip 不会冒出「清除」按钮
//   - 面板已移除「招聘类型」，因此 chip 是该维度**唯一**控件，结构上不可能再出现
//     旧版「chip=实习 + 面板=校招」那种互相矛盾的条件
const CHIPS = JOB_TYPES.map((t) => ({ key: t as string, label: t as string }));

// 复合搜索可回显的条件标签
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

// 单维度匹配判定（sel 为空 = 不筛）。
// **计数**与**实际筛选**必须共用这一份逻辑，否则两套规则会漂移成"数字和结果对不上"。
function matchDim(j: JobView, k: Dim, sel: string[]): boolean {
  if (!sel.length) return true;
  switch (k) {
    case "city":
      return sel.includes(j.city);
    case "industry":
      return sel.includes(j.industry);
    case "companyType":
      return sel.includes(j.companyType);
    case "cohort": {
      const s = sel.filter((c) => c !== COHORT_ANY);
      return s.length === 0 ? true : s.includes(j.cohort);
    }
    case "school":
      return sel.some((s) => s && j.source.includes(s));
    case "deadline":
      return sel.some((bk) => matchDeadlineBucket(j.deadlineDays, bk));
    case "degree": {
      // 向下兼容：取最高学历作为"我的学历"，显示岗位要求层级 ≤ 我的层级
      const my = Math.max(...sel.map((d) => DEGREE_FILTER_LEVEL[d] ?? 0));
      return degreeLevel(j.degree) <= my;
    }
    default:
      return true;
  }
}

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
  // 顶部 chip 的招聘类型：单选（"" = 不限类型）。与面板 filters 相互独立，
  // 不计入 activeCount —— 点 chip 不应触发「清除」按钮。
  const [chip, setChip] = useState("");
  // 薪资条件只可能来自复合搜索（面板无薪资维度）
  const [salary, setSalary] = useState<{ min?: number; max?: number } | null>(null);
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

  // 当前 chip 下真正适用的维度：同时决定「显示哪些」与「生效哪些」，
  // 两者必须来自同一个列表，否则会出现"看不见但被筛掉"的静默过滤。
  const applicable = useMemo(() => APPLICABLE_BY_TYPE[chip] ?? APPLICABLE_BY_TYPE[""], [chip]);

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
    // 顶部类型是所有计数的底色
    const typeBase = chip ? jobs.filter((j) => j.jobType === chip) : jobs;
    // 分面计数（标准做法）：维度 D 的计数基数 = 顶部类型 + **除 D 以外**的其他已选条件。
    // 这样"数字"就等于"点下去真正能拿到多少"；若只按类型算，会出现
    // 「互联网 120」但一点下去 0 条（因为还选了城市）这种假数字。
    const baseFor = (self: Dim): JobView[] => {
      let l = typeBase;
      for (const k of applicable) {
        if (k === self) continue;
        const sel = filters[k];
        if (!sel.length) continue;
        l = l.filter((j) => matchDim(j, k, sel));
      }
      return l;
    };
    // 招聘类型：由顶部 chip 单选承担，面板不再展示该维度（保留键位以免类型缺失）
    m.jobType = JOB_TYPES.map((v) => ({
      v,
      n: jobs.filter((j) => j.jobType === v).length,
    }));
    // 城市：标准城市树（选项集固定，只有计数随上方条件收缩）
    m.city = cityOptions(baseFor("city"));
    // 行业：标准类目固定 19 项（含 0 计数项，保持选项集稳定）
    m.industry = industryOptions(baseFor("industry"));
    // 公司性质：固定 4 类
    m.companyType = companyTypeOptions(baseFor("companyType"));
    // 届别：固定档位；「不限届别」计数=基数全部（选中它等于不筛）
    const cBase = baseFor("cohort");
    m.cohort = COHORT_OPTIONS.map((v) => ({
      v,
      n: v === COHORT_ANY ? cBase.length : cBase.filter((j) => j.cohort === v).length,
    }));
    // 学历：固定三档，计数按向下兼容语义（岗位要求层级 ≤ 我的层级）
    const dBase = baseFor("degree");
    m.degree = dimOptions(jobs, "degree").map((v) => ({
      v,
      n: dBase.filter((j) => degreeLevel(j.degree) <= (DEGREE_FILTER_LEVEL[v] ?? 0)).length,
    }));
    // 截止时间：固定六档
    const dlBase = baseFor("deadline");
    m.deadline = DEADLINE_BUCKETS.map((b) => ({
      v: b.key,
      n: dlBase.filter((j) => matchDeadlineBucket(j.deadlineDays, b.key)).length,
    }));
    // 学校：仅从招聘会/宣讲会提取（活动类才有「举办学校」语义）
    const m2 = new Map<string, number>();
    for (const j of baseFor("school")) {
      if (!j.source) continue;
      if (j.jobType !== "招聘会" && j.jobType !== "宣讲会") continue;
      m2.set(j.source, (m2.get(j.source) || 0) + 1);
    }
    m.school = [...m2.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ v, n }));
    return m;
  }, [jobs, chip, filters, applicable]);

  // 复合搜索：解析预览（输入即时可见，Enter 才提交条件）
  const parsed = useMemo(() => parseQuery(q), [q]);

  const list = useMemo(() => {
    let l = jobs;
    // 招聘类型：由顶部 chip 单选承担（与面板 filters 独立）
    if (chip) l = l.filter((j) => j.jobType === chip);
    // 只应用「当前类型适用」的维度。不适用的维度既不显示也不生效，
    // 避免"面板看不见、结果却被筛掉"的静默过滤（值保留，切回校招/实习即恢复）。
    for (const k of applicable) {
      const sel = filters[k];
      if (!sel.length) continue;
      l = l.filter((j) => matchDim(j, k, sel));
    }
    // 薪资：仅由复合搜索产出（面板无薪资维度），区间无交集或未标注薪资则排除
    if (salary && (typeof salary.min === "number" || typeof salary.max === "number")) {
      l = l.filter((j) => {
        if (!j.salaryMin && !j.salaryMax) return false;
        if (typeof salary.min === "number" && (j.salaryMax || j.salaryMin) < salary.min) return false;
        if (typeof salary.max === "number" && j.salaryMin > salary.max) return false;
        return true;
      });
    }
    if (q.trim()) {
      const ql = q.trim().toLowerCase();
      l = l.filter((j) =>
        (j.title + j.company + j.city + j.industry).toLowerCase().includes(ql)
      );
    }
    return sortJobsBy(l, sortMode);
  }, [jobs, filters, q, sortMode, salary, chip, applicable]);

  // 招聘公告没有截止语义（该类型不带 deadline_at），隐藏所有截止相关区块
  const showDeadlineBlocks = chip !== "招聘公告";

  // 「今日截止」与「近期截止 Top 6」必须跟随**当前筛选结果**（顶部 chip + 面板条件 + 搜索）。
  // 早前这两块直接读全量 jobs，导致切换顶部类型时它们纹丝不动（用户实测反馈）。
  const todayJobs = useMemo(
    () => list.filter((j) => j.deadlineDays === 0).sort((a, b) => (a.deadlineAt || "").localeCompare(b.deadlineAt || "")),
    [list]
  );
  const dueSoon = useMemo(
    () =>
      list
        .filter((j) => j.deadlineDays !== null && j.deadlineDays >= 0 && j.deadlineDays <= 30)
        .sort((a, b) => (a.deadlineDays || 0) - (b.deadlineDays || 0)),
    [list]
  );

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const shown = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const dims = useMemo(() => DIMS.filter((d) => applicable.includes(d.key)), [applicable]);

  function toggleDim(d: Dim, v: string) {
    setFilters((prev) => {
      const cur = prev[d];
      // 「不限」（学历）与「不限届别」都是"清空该维度"语义
      if (v === "不限" || v === COHORT_ANY) return { ...prev, [d]: [] };
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      return { ...prev, [d]: next.filter((x) => x !== "不限" && x !== COHORT_ANY) };
    });
  }

  function clearDim(d: Dim) {
    setFilters((prev) => ({ ...prev, [d]: [] }));
  }

  // 重置面板条件（**不含**顶部 chip —— chip 与面板相互独立）
  function resetPanel() {
    setSalary(null);
    setFilters({
      city: [],
      industry: [],
      companyType: [],
      jobType: [],
      cohort: [],
      degree: [],
      school: [],
      deadline: [],
    });
    setCurrentPage(1);
  }

  // 重置全部（含搜索词与顶部 chip）：用于空结果页的"清除筛选"
  function resetAll() {
    setQ("");
    setChip("");
    resetPanel();
  }

  // 提交复合搜索：解析出的条件并入筛选面板（同一份 state），
  // 输入框只保留未识别的关键词——避免「搜索」与「面板」两套条件互相矛盾。
  // 招聘类型由 chip 单一承担：解析到类型时写进 chip，并从 filters 里剔除，避免两份状态。
  function commitQuery() {
    const p = parseQuery(q);
    setFilters((prev) => ({ ...mergeParsed(prev, p.filters), jobType: [] }));
    if (p.filters.jobType.length) setChip(p.filters.jobType[0]);
    setQ(p.keyword);
    // 薪资没有面板维度，单独存；不清除已有值，除非这次搜索带了解析结果
    if (typeof p.filters.salaryMin === "number" || typeof p.filters.salaryMax === "number") {
      setSalary({ min: p.filters.salaryMin, max: p.filters.salaryMax });
    }
    setCurrentPage(1);
  }

  // 已选条件总数：只统计**当前类型适用**的面板维度 + 薪资。
  // - 顶部 chip 不计入——点 chip 不应触发「清除」按钮（chip 与面板相互独立）
  // - 不适用维度即使有残留值也不计入，否则会出现"看不到任何条件却有清除按钮"
  const activeCount =
    applicable.reduce((n, k) => n + filters[k].length, 0) + (salary ? 1 : 0);

  // 薪资无面板维度，只有它能被复合搜索设上；单独给一个可删除 chip
  const salaryLabel = salary
    ? salary.min !== undefined && salary.max !== undefined
      ? `薪资 ${salary.min}-${salary.max}K`
      : salary.min !== undefined
        ? `薪资 ${salary.min}K 以上`
        : `薪资 ${salary.max}K 以下`
    : "";

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

        {/* 薪资条件来自复合搜索，面板没有对应维度，单独给一个可删除 chip */}
        {salaryLabel && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginTop: "10px", fontSize: "12px" }}>
            <button
              onClick={() => {
                setSalary(null);
                setCurrentPage(1);
              }}
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
              {salaryLabel} <span style={{ opacity: 0.7 }}>×</span>
            </button>
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

      {/* ===== 筛选（顶部 chip 单选招聘类型；面板 6 维固定项 + 情境化学校） ===== */}
      <div className="toolbar">
        <div className="chips">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              className={chip === c.key ? "on" : ""}
              // 单选：点同一个即取消（回到"不限类型"）
              onClick={() => setChip((prev) => (prev === c.key ? "" : c.key))}
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
              onClick={resetPanel}
            >
              清除
            </button>
          )}
          <div className={"filter-panel" + (openDim ? " open" : "")}>
            {/* 只渲染「当前类型适用」维度的面板——否则切换 chip 后可能露出已隐藏维度的选项 */}
            {openDim && applicable.includes(openDim) && <FilterOptions dim={openDim} opts={dimOpts[openDim]} filters={filters} toggleDim={toggleDim} clearDim={clearDim} setCurrentPage={setCurrentPage} onCityChange={(next) => { setFilters((f) => ({ ...f, city: next })); setCurrentPage(1); }} />}
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
          {showDeadlineBlocks && (
            <>
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
            </>
          )}

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
              <button onClick={resetAll}>
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
          {showDeadlineBlocks && (
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
          )}

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
