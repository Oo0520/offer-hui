import { NextRequest, NextResponse } from "next/server";
import { fetchAllJobs, SOURCE_NAME } from "@/lib/jobs";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// GET /api/v1/sources 数据源清单 + 各源岗位数
export async function GET(req: NextRequest) {
  const rl = rateLimit(clientIp(req));
  if (!rl.ok)
    return NextResponse.json({ code: 429, error: "请求过于频繁" }, { status: 429 });

  try {
    const jobs = await fetchAllJobs();
    const m = new Map<string, number>();
    for (const j of jobs) m.set(j.source, (m.get(j.source) || 0) + 1);
    const data = [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        source: key,
        name: SOURCE_NAME[key] || key,
        count,
      }));
    return NextResponse.json({ code: 0, data, total: jobs.length });
  } catch (e) {
    return NextResponse.json(
      { code: 500, error: `查询失败: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
