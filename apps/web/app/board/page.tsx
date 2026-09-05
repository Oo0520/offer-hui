import BoardClient from "@/components/BoardClient";
export const dynamic = "force-dynamic";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "求职看板 · Offer汇" };

export default async function BoardPage() {
  const jobs = await fetchAllJobs();
  return <BoardClient jobs={jobs} />;
}
