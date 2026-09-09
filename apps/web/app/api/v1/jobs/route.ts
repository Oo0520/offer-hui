import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllJobs,
  filterJobs,
  sortJobsBy,
  dimOptions,
  type SortMode,
} from "@/lib/jobs";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export type JobListParams = {
  q?: string;
  job_type?: string; // 校招|实习|招聘会
  city?: string;
  industry?: string;
  cohort?: string;
  degree?: string; // 不限|专科及以上|本科及以上|硕士及以上
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
    const filtered = filterJobs(jobs, {
      q: sp.get("q") || undefined,
      jobType: sp.get("job_type") || undefined,
      city: sp.get("city") || undefined,
      industry: sp.get("industry") || undefined,
      cohort: sp.get("cohort") || undefined,
      degree: sp.get("degree") || undefined,
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
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, error: `查询失败: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}

export { dimOptions };
