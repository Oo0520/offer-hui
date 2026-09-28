import { fetchAllJobs, type JobView } from "@/lib/jobs";
import { NextRequest, NextResponse } from "next/server";

// 服务端动态生成 ICS 订阅文件，手机日历通过 URL 订阅后自动同步
// force-dynamic：避免构建时静态预渲染（构建环境无 Supabase 凭据），
// 改为每次请求实时生成；响应头 Cache-Control: max-age=300 承担缓存。
export const dynamic = "force-dynamic";
export const revalidate = 300;

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;

const AUTH_HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
};

// 订阅筛选条件（与 subscriptions.filters jsonb 结构一致）
export type SubFilters = {
  cities?: string[];
  industries?: string[];
  job_types?: string[];
  cohort?: string;
};

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

// 按 token 查订阅（ics_enabled 必须为 true，否则按无效 token 处理）
async function fetchSubFilters(token: string): Promise<SubFilters | null> {
  try {
    const res = await fetch(
      `${URL}/rest/v1/subscriptions?select=filters,ics_enabled&ics_token=eq.${encodeURIComponent(token)}&limit=1`,
      { headers: AUTH_HEADERS },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const row = rows?.[0];
    if (!row || row.ics_enabled !== true) return null;
    return (row.filters || {}) as SubFilters;
  } catch {
    return null;
  }
}

// 与前端 filterJobs 同语义的筛选（城市/行业/类型精确匹配，届别相等匹配）
function applySubFilters(jobs: JobView[], f: SubFilters): JobView[] {
  if (!f) return jobs;
  const cities = f.cities || [];
  const industries = f.industries || [];
  const jobTypes = f.job_types || [];
  const cohort = f.cohort || "";
  if (!cities.length && !industries.length && !jobTypes.length && !cohort) return jobs;
  return jobs.filter((j) => {
    if (cities.length && !cities.includes(j.city)) return false;
    if (industries.length && !industries.includes(j.industry)) return false;
    if (jobTypes.length && !jobTypes.includes(j.jobType)) return false;
    if (cohort && j.cohort !== cohort) return false;
    return true;
  });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  let filters: SubFilters | null = null;
  if (token) {
    filters = await fetchSubFilters(token);
    if (!filters) {
      return new NextResponse("invalid calendar subscription token", { status: 404 });
    }
  }

  const jobs = await fetchAllJobs();
  // 未来 90 天内有明确截止日期的岗位
  let soon = jobs.filter(
    (j) =>
      j.deadlineAt &&
      j.deadlineDays !== null &&
      j.deadlineDays >= 0 &&
      j.deadlineDays <= 90,
  );
  if (filters) soon = applySubFilters(soon, filters);
  soon.sort((a, b) => (a.deadlineDays || 0) - (b.deadlineDays || 0));

  const dtstamp =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const calName = filters ? "Offer派 个性化校招截止提醒" : "Offer派 校招截止提醒";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OfferHui//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calName}`,
    "X-WR-TIMEZONE:Asia/Shanghai",
    "X-WR-CALDESC:Offer派聚合的校招/实习岗位截止日期提醒",
  ];

  for (const j of soon) {
    const date = (j.deadlineAt || "").replace(/-/g, "");
    const summary = `截止提醒 · ${j.title}（${j.company}）`;
    const desc = `${j.company} · ${j.city} · ${j.jobType}${j.cohort ? " · " + j.cohort : ""}\\n投递入口: ${j.applyUrl || ""}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${j.id}@offerhui`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(desc)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="offerhui-ddl.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
