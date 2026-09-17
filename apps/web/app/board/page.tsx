import BoardClient from "@/components/BoardClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "求职看板 · Offer派" };

// 依赖实时数据（Supabase），禁止构建期静态预渲染
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const jobs = await fetchAllJobs();
  return <BoardClient jobs={jobs} />;
}
