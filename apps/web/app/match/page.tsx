import MatchClient from "@/components/MatchClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "AI 匹配 · Offer派" };

// 依赖实时数据（Supabase），禁止构建期静态预渲染
export const dynamic = "force-dynamic";

export default async function MatchPage() {
  const jobs = await fetchAllJobs();
  return <MatchClient jobs={jobs} />;
}
