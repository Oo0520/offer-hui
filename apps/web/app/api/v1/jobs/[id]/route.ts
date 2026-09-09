import { NextRequest, NextResponse } from "next/server";
import { fetchAllJobs } from "@/lib/jobs";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit(clientIp(_req));
  if (!rl.ok)
    return NextResponse.json({ code: 429, error: "请求过于频繁" }, { status: 429 });

  const { id } = await params;
  try {
    const jobs = await fetchAllJobs();
    const j = jobs.find((x) => x.id === id);
    if (!j) {
      return NextResponse.json({ code: 404, error: "岗位不存在" }, { status: 404 });
    }
    return NextResponse.json({
      code: 0,
      data: {
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
        posted_at: j.postedAt,
        source: j.source,
        source_key: j.sourceKey,
        source_url: j.sourceUrl,
        apply_url: j.applyUrl,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, error: `查询失败: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
