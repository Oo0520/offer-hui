import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllJobs,
  filterJobs,
  sortJobsBy,
  dimOptions,
  type SortMode,
} from "@/lib/jobs";
import { parseQuery } from "@/lib/queryParser";
import { toJobTypeLabels } from "@/lib/taxonomy";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export type JobListParams = {
  q?: string; // 复合搜索：如 "福州 实习 本科 15K以上 本周"
  job_type?: string; // 库内枚举 campus|job|intern|teachin|fair|announcement，或中文标签「校招|实习|宣讲会|招聘会|招聘公告」（逗号分隔可多选）
  city?: string;
  industry?: string;
  company_type?: string;
  cohort?: string;
  degree?: string; // 专科|本科|硕士（向下兼容：显示该学历能投的岗位，含不限）
  deadline?: string; // today|d3|d7|d30|past|none
  salary_min?: number; // 单位 K
  salary_max?: number;
  sort?: SortMode;
  page?: number;
  page_size?: number;
};

export async function GET(req: NextRequest) {
  // 限流（公开只读防护）
  const rl = rateLimit(clientIp(req));
  if (!rl.ok) {
    return NextResponse.json(
      { code: 429, error: `请求过于频繁，请在 ${rl.resetInSec}s 后重试` },
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } },
    );
  }

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") || 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("page_size") || 20) || 20));

  try {
    const jobs = await fetchAllJobs();
    // q 走复合搜索解析（与首页/顶部搜索同一解析器）；显式参数优先于解析结果
    const parsed = parseQuery(sp.get("q") || "");
    const numOrUndef = (v: string | null) => {
      const n = Number(v);
      return v !== null && v !== "" && Number.isFinite(n) ? n : undefined;
    };
    const orParsed = (explicit: string | null, arr: string[]) =>
      explicit || (arr.length ? arr : undefined);

    const filtered = filterJobs(jobs, {
      q: parsed.keyword || undefined,
      // job_type 接受枚举（campus/intern/…）或中文标签；枚举需映射为展示标签
      jobType: sp.get("job_type")
        ? toJobTypeLabels(sp.get("job_type") as string)
        : parsed.filters.jobType.length
          ? parsed.filters.jobType
          : undefined,
      city: orParsed(sp.get("city"), parsed.filters.city),
      industry: orParsed(sp.get("industry"), parsed.filters.industry),
      companyType: orParsed(sp.get("company_type"), parsed.filters.companyType),
      cohort: orParsed(sp.get("cohort"), parsed.filters.cohort),
      degree: orParsed(sp.get("degree"), parsed.filters.degree),
      school: parsed.filters.school.length ? parsed.filters.school : undefined,
      deadline: sp.get("deadline")
        ? [sp.get("deadline") as string]
        : parsed.filters.deadline.length
          ? parsed.filters.deadline
          : undefined,
      salaryMin: numOrUndef(sp.get("salary_min")) ?? parsed.filters.salaryMin,
      salaryMax: numOrUndef(sp.get("salary_max")) ?? parsed.filters.salaryMax,
    });
    const sorted = sortJobsBy(filtered, (sp.get("sort") as SortMode) || "deadline");
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const rows = sorted.slice(start, start + pageSize).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      city: j.city,
      industry: j.industry,
      job_type: j.jobType,
      degree: j.degree,
      cohort: j.cohort,
      salary_text: j.salaryText,
      deadline_at: j.deadlineAt,
      deadline_days: j.deadlineDays,
      posted_at: j.postedAt,
      source: j.source,
      source_url: j.sourceUrl,
      apply_url: j.applyUrl,
    }));

    return NextResponse.json({
      code: 0,
      data: rows,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
      // 回传复合搜索的识别结果，便于调用方核对"条件被理解成了什么"（不静默过滤）
      q_parsed: {
        keyword: parsed.keyword,
        tokens: parsed.tokens.map((t) => ({ field: t.field, value: t.value, label: t.label })),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, error: `查询失败: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}

export { dimOptions };
