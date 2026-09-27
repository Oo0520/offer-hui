// 按需重新验证（on-demand revalidation）
// 数据入库后，由每日定时任务以 GET 调用本接口，失效 jobs 数据缓存（unstable_cache）与各静态页面，
// 使网站和 ICS 立即拉取最新数据，无需 git push 重新构建。
// 用法: GET /api/revalidate?secret=<ADMIN_TOKEN>
import { revalidateTag, revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  const token = process.env.ADMIN_TOKEN || "";
  if (!token || secret !== token) {
    return Response.json(
      { revalidated: false, error: "invalid secret" },
      { status: 401 }
    );
  }
  try {
    // 失效 fetchAllJobs 的 unstable_cache（tag = "jobs"），立即过期
    revalidateTag("jobs", { expire: 0 });
    // 失效构建时静态生成 / ISR 页面，下次访问按需重新生成
    revalidatePath("/");
    revalidatePath("/calendar");
    revalidatePath("/match");
    revalidatePath("/favorites");
    revalidatePath("/board");
    return Response.json({
      revalidated: true,
      at: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json(
      { revalidated: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
