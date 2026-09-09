import { NextRequest, NextResponse } from "next/server";
import { fetchAllJobs } from "@/lib/jobs";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// GET /api/v1/stats 全库统计
export async function GET(req: NextRequest) {
  const rl = rateLimit(clientIp(req));
  if (!rl.ok)
    return NextResponse.json({ code: 429, error: "请求过于频繁" }, { status: 429 });

  try {
    const jobs = await fetchAllJobs();
    const companies = new Set(jobs.map((j) => j.company)).size;
    const due30 = jobs.filter(
      (j) => j.deadlineDays !== null && j.deadlineDays >= 0 && j.deadlineDays <= 30,
    ).length;
    const byType: Record<string, number> = {};
    for (const j of jobs) byType[j.jobType] = (byType[j.jobType] || 0) + 1;
    return NextResponse.json({
      code: 0,
      data: {
        total: jobs.length,
        companies,
        due30,
        by_type: byType,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { code: 500, error: `查询失败: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
