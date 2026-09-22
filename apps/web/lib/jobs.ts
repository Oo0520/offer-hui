// 岗位数据层：Supabase REST 拉取 + 展示字段映射
// 服务端使用（密钥不暴露浏览器），客户端组件接收映射后的 JobView[]
import { unstable_cache } from "next/cache";

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
  fj99: "福建就业网",
  feishu_nio: "蔚来官网",
  feishu_mi: "小米官网",
  feishu_xiaopeng: "小鹏汽车官网",
  campus2027: "Campus2027社区",
  open_jobs: "open-jobs数据",
  wechat: "企业公众号",
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

export function fmtSalary(j: JobRow): string {
  if (j.salary_text) return j.salary_text;
  if (j.salary_min && j.salary_max)
    return `${j.salary_min}-${j.salary_max}K`;
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
    days = Math.round((t - Date.now()) / 86400000);
  }
  const industry = r.industry || "未分类";
  return {
    id: r.id,
    title: r.title,
    company,
    city: r.city || "全国",
    industry,
    jobType,
    degree: r.degree || "学历不限",
    cohort: r.cohort || "",
    salaryText: fmtSalary(r),
    salaryMin: r.salary_min || 0,
    salaryMax: r.salary_max || 0,
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
  "id,source,source_url,external_id,title,city,industry,job_type,degree,cohort,salary_min,salary_max,salary_text,deadline_at,posted_at,apply_url,companies(name)";

// PostgREST 服务端单请求上限 1000 行（db-max-rows），数据超 1000 需分页循环拉取
const PAGE_SIZE = 1000;

async function _fetchAllJobsRaw(): Promise<JobView[]> {
  const all: JobRow[] = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams();
    params.set("select", RAW_FETCH_FIELDS);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    const url = `${URL}/rest/v1/jobs?${params.toString()}`;
    const res = await fetch(url, { headers: AUTH_HEADERS });
    if (!res.ok) throw new Error(`Supabase 查询失败 ${res.status}: ${(await res.text()).slice(0, 200)}`);
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

// 学历层级映射：不限=0, 专科=1, 本科=2, 硕士=3, 博士=4
export function degreeLevel(degree: string | null | undefined): number {
  const d = (degree || "").trim();
  if (!d || d.includes("不限")) return 0;
  if (d.includes("博士")) return 4;
  if (d.includes("硕士")) return 3;
  if (d.includes("本科")) return 2;
  if (d.includes("专科") || d.includes("大专")) return 1;
  return 0;
}

// 筛选器选项 → 最低层级
export const DEGREE_FILTER_LEVEL: Record<string, number> = {
  "专科及以上": 1,
  "本科及以上": 2,
  "硕士及以上": 3,
  "博士及以上": 4,
};

// 筛选维度选项（按出现次数降序）
export function dimOptions(jobs: JobView[], key: "city" | "industry" | "cohort" | "degree"): string[] {
  if (key === "degree") {
    return ["专科及以上", "本科及以上", "硕士及以上", "博士及以上"];
  }
  const m = new Map<string, number>();
  for (const j of jobs) {
    const v = j[key] || "";
    if (!v || v === "未分类" || v === "学历不限") continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

export type JobFilter = {
  q?: string;
  jobType?: string; // "校招" | "实习"
  city?: string;
  industry?: string;
  cohort?: string;
  degree?: string;
};

export function filterJobs(jobs: JobView[], f: JobFilter): JobView[] {
  return jobs.filter((j) => {
    if (f.jobType && j.jobType !== f.jobType) return false;
    if (f.city && j.city !== f.city) return false;
    if (f.industry && j.industry !== f.industry) return false;
    if (f.cohort && j.cohort !== f.cohort) return false;
    if (f.degree && f.degree !== "不限") {
      const minLevel = DEGREE_FILTER_LEVEL[f.degree] ?? 0;
      if (degreeLevel(j.degree) < minLevel) return false;
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
