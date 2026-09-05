// 服务端数据访问层：用原生 fetch 调 Supabase REST API（零第三方依赖）
// 仅在 Server Components / Route Handlers 中使用，key 不暴露给浏览器。

export type JobRow = {
  id: string;
  company_id: string | null;
  source: string;
  source_url: string;
  external_id: string;
  title: string;
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
  tags: unknown;
  content_hash: string | null;
  created_at: string;
  company_name?: string | null;
};

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;

const AUTH_HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

type QueryOptions = {
  select?: string;
  filters?: Record<string, string | string[]>; // PostgREST 过滤，如 { city: "eq.北京" } 或同列多条件数组
  order?: string; // 如 "deadline_at.asc"
  limit?: number;
};

export async function queryJobs(opts: QueryOptions): Promise<JobRow[]> {
  const params = new URLSearchParams();
  params.set("select", opts.select ?? "*,companies(name)");
  if (opts.order) params.set("order", opts.order);
  if (opts.limit) params.set("limit", String(opts.limit));
  for (const [k, v] of Object.entries(opts.filters ?? {})) {
    if (Array.isArray(v)) {
      for (const x of v) params.append(k, x);
    } else {
      params.set(k, v);
    }
  }
  const url = `${URL}/rest/v1/jobs?${params.toString()}`;
  const res = await fetch(url, { headers: AUTH_HEADERS, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase 查询失败 ${res.status}: ${body.slice(0, 300)}`);
  }
  const rows = (await res.json()) as JobRow[];
  // companies(name) 关联返回 { companies: { name } }
  return rows.map((r) => ({
    ...r,
    company_name: (r as unknown as { companies?: { name?: string } }).companies
      ?.name,
  }));
}

export async function queryDistinct(
  column: string,
  extraFilters?: Record<string, string>
): Promise<string[]> {
  const params = new URLSearchParams();
  params.set("select", column);
  if (extraFilters) {
    for (const [k, v] of Object.entries(extraFilters)) params.set(k, v);
  }
  const url = `${URL}/rest/v1/jobs?${params.toString()}`;
  const res = await fetch(url, { headers: AUTH_HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Supabase 查询失败 ${res.status}`);
  const rows = (await res.json()) as Record<string, unknown>[];
  const set = new Set<string>();
  for (const r of rows) {
    const v = r[column];
    if (typeof v === "string" && v.trim()) set.add(v.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
}
