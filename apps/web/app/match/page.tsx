import MatchClient from "@/components/MatchClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "AI 匹配 · Offer汇" };

export default async function MatchPage() {
  const jobs = await fetchAllJobs();
  return <MatchClient jobs={jobs} />;
}
