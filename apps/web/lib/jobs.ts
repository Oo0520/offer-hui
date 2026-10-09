// 岗位数据层：Supabase REST 拉取 + 展示字段映射
// 服务端使用（密钥不暴露浏览器），客户端组件接收映射后的 JobView[]
import { unstable_cache } from "next/cache";
import { CITY_PROVINCES } from "./cityTree";
import { INDUSTRY_LIST } from "./industryList";
import { degreeLevel, DEGREE_FILTER_LEVEL, COMPANY_TYPE_LIST } from "./taxonomy";

// 词表统一由 lib/taxonomy.ts 定义，这里转出以保持既有 import 路径可用
export { degreeLevel, DEGREE_FILTER_LEVEL, COMPANY_TYPE_LIST };

export type JobRow = {
  id: string;
  company_id: string | null;
  source: string;
  source_url: string;
  external_id: string;
  title: string;
  description: string | null;
  city: string | null;
  province: string | null;
  industry: string | null;
  company_type: string | null;
  job_type: string | null;
  degree: string | null;
  cohort: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_text: string | null;
  deadline_at: string | null;
  posted_at: string | null;
  apply_url: string;
  status: string;
  is_hot: boolean;
  is_intern: boolean;
  tags: unknown;
  content_hash: string | null;
  embedding: unknown;
  created_at: string;
  updated_at: string;
  companies?: { name?: string } | null;
};

export type JobView = {
  id: string;
  title: string;
  company: string;
  city: string;
  industry: string;
  companyType: string;
  jobType: "校招" | "实习" | "招聘会" | "宣讲会" | "招聘公告";
  degree: string;
  cohort: string;
  salaryText: string;
  salaryMin: number;
  salaryMax: number;
  deadlineAt: string | null; // YYYY-MM-DD
  deadlineDays: number | null; // 距今天数（正=未到期，0=今天，负=已过期，null=无截止）
  postedAt: string | null;
  applyUrl: string;
  sourceUrl: string;
  source: string; // 中文数据源名
  sourceKey: string;
  lg: string; // 公司徽标首字
  bg: string; // 徽标渐变
};

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;

const AUTH_HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

export const SOURCE_NAME: Record<string, string> = {
  ncss: "国家24365平台",
  fjut: "福建理工大学就业网",
  fjrclh: "福州大学",
  jmu: "集美大学就业网",
  xmu: "厦门大学就业网",
  fj99: "福建就业网",
  zhaopin_h5: "智联招聘H5",
  feishu_nio: "蔚来官网",
  feishu_mi: "小米官网",
  feishu_xiaopeng: "小鹏汽车官网",
  campus2027: "Campus2027社区",
  open_jobs: "open-jobs数据",
  wechat: "企业公众号",
  user_submit: "用户投稿",
};

const GRADS = [
  "linear-gradient(135deg,#8b5cf6,#6366f1)",
  "linear-gradient(135deg,#06b6d4,#22d3ee)",
  "linear-gradient(135deg,#ec4899,#8b5cf6)",
  "linear-gradient(135deg,#10b981,#34d399)",
  "linear-gradient(135deg,#f97316,#fb923c)",
  "linear-gradient(135deg,#0ea5e9,#38bdf8)",
  "linear-gradient(135deg,#ca0013,#f43f5e)",
  "linear-gradient(135deg,#14b8a6,#10b981)",
  "linear-gradient(135deg,#e11d48,#ef4444)",
  "linear-gradient(135deg,#6366f1,#d946ef)",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// 薪资单位归一（读取时归一，不改库）：
// 库内存在两种口径——部分源存「元」(如 8000-11000)，部分存「K」(如 6-9)。
// 统一换算为 K：>=1000 视为元；否则按 K。（存量清洗阶段应在入库侧统一，届时本函数可简化为恒等）
export function salaryToK(v: number | null | undefined): number {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 1000 ? Math.round(n / 100) / 10 : n;
}

// 形如 "0.0-0.0K" 的占位噪声（ncss 源），不作为展示文案
const SALARY_NOISE_RE = /^0(?:\.0)?\s*[-~至]\s*0(?:\.0)?\s*[kK千]?$/;

export function fmtSalary(j: JobRow): string {
  const text = (j.salary_text || "").trim();
  if (text && !SALARY_NOISE_RE.test(text)) return text;
  const min = salaryToK(j.salary_min);
  const max = salaryToK(j.salary_max);
  if (min && max) return `${min}-${max}K`;
  if (min) return `${min}K 起`;
  return "";
}

// 北京时区今天 0 点的时间戳
export function bjDayStart(now = new Date()): number {
  const ms = now.getTime() + 8 * 3600 * 1000;
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 8 * 3600 * 1000;
}

export function toView(r: JobRow): JobView {
  const company = r.companies?.name || "官方发布";
  const jobType = (r.job_type === "intern" ? "实习" : r.job_type === "fair" ? "招聘会" : r.job_type === "teachin" ? "宣讲会" : r.job_type === "announcement" ? "招聘公告" : "校招") as JobView["jobType"];
  const dl = r.deadline_at ? r.deadline_at.slice(0, 10) : null;
  let days: number | null = null;
  if (dl) {
    const t = new Date(dl + "T00:00:00+08:00").getTime();
    // 基准必须是**北京今日 0 点**，不能是 Date.now()：
    // 两者都是北京 0 点，差值恰为整天数，Math.round 无歧义。
    // 用 Date.now() 会随一天中的时刻漂移——中午 12 点后「今天截止」会被算成 -1（判定为已截止），
    // 「今天截止」档里显示的其实是明天到期的岗位（2026-10-09 22:01 实测：13 vs 真实 11）。
    days = Math.round((t - bjDayStart()) / 86400000);
  }
  const industry = r.industry || "未分类";
  return {
    id: r.id,
    title: r.title,
    company,
    city: r.city || "全国",
    industry,
    companyType: r.company_type || "",
    jobType,
    degree: r.degree || "学历不限",
    cohort: r.cohort || "",
    salaryText: fmtSalary(r),
    salaryMin: salaryToK(r.salary_min),
    salaryMax: salaryToK(r.salary_max),
    deadlineAt: dl,
    deadlineDays: days,
    postedAt: r.posted_at ? r.posted_at.slice(0, 10) : null,
    applyUrl: r.apply_url || r.source_url,
    sourceUrl: r.source_url,
    source: SOURCE_NAME[r.source] || r.source,
    sourceKey: r.source,
    lg: (company || "汇").trim().charAt(0) || "汇",
    bg: GRADS[hashStr(industry + company) % GRADS.length],
  };
}

// 全量拉取（unstable_cache 共享缓存，所有页面 60s 内只打一次 Supabase）
const RAW_FETCH_FIELDS =
  "id,source,source_url,external_id,title,city,industry,company_type,job_type,degree,cohort,salary_min,salary_max,salary_text,deadline_at,posted_at,apply_url,companies(name)";

// PostgREST 服务端单请求上限 1000 行（db-max-rows），数据超 1000 需分页循环拉取
const PAGE_SIZE = 1000;

// 只取 published：本函数用 service key（绕过 RLS），若不显式过滤会把
// status='expired' 的已下架岗位一并下发到前端（实测约 18%）。MCP 侧本就按 published 过滤。
const RAW_STATUS_FILTER = "published";

async function _fetchAllJobsRaw(): Promise<JobView[]> {
  const all: JobRow[] = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams();
    params.set("select", RAW_FETCH_FIELDS);
    params.set("status", `eq.${RAW_STATUS_FILTER}`);
    // 显式稳定排序：无 ORDER BY 的 offset 分页在并发写入时可能重复/漏行
    params.set("order", "id.asc");
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    const url = `${URL}/rest/v1/jobs?${params.toString()}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: AUTH_HEADERS });
    } catch (e) {
      console.warn(`[jobs] Supabase fetch failed, fallback to empty:`, (e as Error).message);
      return [];
    }
    if (!res.ok) {
      console.warn(`[jobs] Supabase returned ${res.status}, fallback to empty`);
      return [];
    }
    const rows = (await res.json()) as JobRow[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all.map(toView);
}

export const fetchAllJobs = unstable_cache(_fetchAllJobsRaw, ["all-jobs"], {
  revalidate: false,
  tags: ["jobs"],
});

// 筛选维度选项（按出现次数降序）
export function dimOptions(jobs: JobView[], key: "city" | "industry" | "cohort" | "degree" | "companyType"): string[] {
  if (key === "degree") {
    return ["专科", "本科", "硕士"];
  }
  const m = new Map<string, number>();
  for (const j of jobs) {
    const v = j[key] || "";
    if (!v || v === "未分类" || v === "学历不限") continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

// 完整城市选项：全部标准城市 + 计数（无岗位的城市计数 0）。含"全国"与库内海外兜底值。
export function cityOptions(jobs: JobView[]): { v: string; n: number }[] {
  const cnt = new Map<string, number>();
  for (const j of jobs) {
    if (!j.city) continue;
    cnt.set(j.city, (cnt.get(j.city) || 0) + 1);
  }
  const out: { v: string; n: number }[] = [];
  if (cnt.has("全国")) out.push({ v: "全国", n: cnt.get("全国")! });
  const seen = new Set<string>();
  for (const cities of Object.values(CITY_PROVINCES)) {
    for (const c of cities) {
      seen.add(c);
      out.push({ v: c, n: cnt.get(c) || 0 });
    }
  }
  // 库内不在标准树里的值（海外等）追加兜底
  for (const [c, n] of cnt) {
    if (c !== "全国" && !seen.has(c)) out.push({ v: c, n });
  }
  return out;
}

// 完整行业选项：标准 19 类 + 计数（无岗位的类目计数 0）+ 库内兜底值
export function industryOptions(jobs: JobView[]): { v: string; n: number }[] {
  const cnt = new Map<string, number>();
  for (const j of jobs) {
    if (!j.industry) continue;
    cnt.set(j.industry, (cnt.get(j.industry) || 0) + 1);
  }
  const out = INDUSTRY_LIST.map((v) => ({ v, n: cnt.get(v) || 0 }));
  for (const [c, n] of cnt) {
    if (!INDUSTRY_LIST.includes(c)) out.push({ v: c, n });
  }
  return out;
}

// 完整公司性质选项：标准 4 类 + 计数（无数据的计数 0）
export function companyTypeOptions(jobs: JobView[]): { v: string; n: number }[] {
  const cnt = new Map<string, number>();
  for (const j of jobs) {
    if (!j.companyType) continue;
    cnt.set(j.companyType, (cnt.get(j.companyType) || 0) + 1);
  }
  return COMPANY_TYPE_LIST.map((v) => ({ v, n: cnt.get(v) || 0 }));
}

// 单值或多值：复合搜索会一次性产出多个同类条件（如「北京 上海」）
type Multi = string | string[];

export type JobFilter = {
  q?: string;
  jobType?: Multi; // "校招" | "实习" | "宣讲会" | "招聘会" | "招聘公告"
  city?: Multi;
  industry?: Multi;
  companyType?: Multi;
  cohort?: Multi;
  degree?: Multi;
  deadline?: string[]; // 截止档 key，见 lib/taxonomy.ts DEADLINE_BUCKETS
  // 学校：当前由数据源名派生（源名形如「集美大学就业网」），故用子串匹配。
  // 待 xmu/jmu 爬虫补录后再引入真实 school 字段。
  school?: Multi;
  salaryMin?: number;
  salaryMax?: number;
};

/** 多值语义为「或」；未给出该字段一律视为不限制 */
function matchMulti(v: Multi | undefined, actual: string): boolean {
  if (v === undefined) return true;
  return Array.isArray(v) ? v.includes(actual) : v === actual;
}

function maxDegreeLevel(v: Multi | undefined): number | null {
  if (v === undefined) return null;
  const arr = Array.isArray(v) ? v : [v];
  if (arr.length === 0) return null;
  if (arr.includes("不限")) return 0;
  return Math.max(...arr.map((d) => DEGREE_FILTER_LEVEL[d] ?? 0));
}

export function filterJobs(jobs: JobView[], f: JobFilter): JobView[] {
  const myLevel = maxDegreeLevel(f.degree);
  return jobs.filter((j) => {
    if (!matchMulti(f.jobType, j.jobType)) return false;
    if (!matchMulti(f.city, j.city)) return false;
    if (!matchMulti(f.industry, j.industry)) return false;
    if (!matchMulti(f.companyType, j.companyType)) return false;
    if (!matchMulti(f.cohort, j.cohort)) return false;
    if (f.school !== undefined && f.school.length) {
      // 子串匹配：用户输入「集美大学」要能命中源名「集美大学就业网」
      const arr = Array.isArray(f.school) ? f.school : [f.school];
      if (!arr.some((s) => s && j.source.includes(s))) return false;
    }
    if (f.deadline && f.deadline.length) {
      const days = j.deadlineDays;
      const ok = f.deadline.some((k) => {
        if (k === "none") return days === null;
        if (days === null) return false;
        if (k === "past") return days < 0;
        const want = k === "today" ? 0 : k === "d3" ? 3 : k === "d7" ? 7 : k === "d30" ? 30 : -1;
        return want >= 0 && days >= 0 && days <= want;
      });
      if (!ok) return false;
    }
    if (typeof f.salaryMin === "number" && (j.salaryMax || j.salaryMin) < f.salaryMin) return false;
    if (typeof f.salaryMax === "number" && j.salaryMin > f.salaryMax) return false;
    if (myLevel !== null) {
      // 向下兼容：岗位要求层级 <= 我的学历层级（学历不限 level=0 恒满足）
      if (degreeLevel(j.degree) > myLevel) return false;
    }
    if (f.q) {
      const q = f.q.trim().toLowerCase();
      if (!(j.title + j.company + j.city + j.industry).toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// 排序：有截止的先按剩余天数升序，无截止的按发布时间降序
export type SortMode = "deadline" | "newest" | "salary";

// 按模式排序：deadline=截止最近（无截止靠后，同按发布时间），newest=最新发布，salary=薪资最高（按薪资下限）
export function sortJobsBy(jobs: JobView[], mode: SortMode): JobView[] {
  const arr = [...jobs];
  if (mode === "newest") {
    return arr.sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""));
  }
  if (mode === "salary") {
    return arr.sort((a, b) => {
      if (b.salaryMin !== a.salaryMin) return b.salaryMin - a.salaryMin;
      if (b.salaryMax !== a.salaryMax) return b.salaryMax - a.salaryMax;
      return (b.postedAt || "").localeCompare(a.postedAt || "");
    });
  }
  return arr.sort((a, b) => {
    const ad = a.deadlineDays,
      bd = b.deadlineDays;
    const aHas = ad !== null && ad >= 0,
      bHas = bd !== null && bd >= 0;
    if (aHas && bHas) return ad! - bd!;
    if (aHas) return -1;
    if (bHas) return 1;
    return (b.postedAt || "").localeCompare(a.postedAt || "");
  });
}
