import MatchClient from "@/components/MatchClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "AI 匹配 · Offer派" };

// build 时静态预渲染
export const dynamic = "force-static";

export default async function MatchPage() {
  const jobs = await fetchAllJobs();
  return <MatchClient jobs={jobs} />;
}
