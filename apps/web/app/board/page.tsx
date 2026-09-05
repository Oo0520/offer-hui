import BoardClient from "@/components/BoardClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "求职看板 · Offer派" };

export default async function BoardPage() {
  const jobs = await fetchAllJobs();
  return <BoardClient jobs={jobs} />;
}
