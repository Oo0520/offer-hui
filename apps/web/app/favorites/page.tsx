import FavoritesClient from "@/components/FavoritesClient";
export const dynamic = "force-dynamic";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "我的收藏 · Offer汇" };

export default async function FavoritesPage() {
  const jobs = await fetchAllJobs();
  return <FavoritesClient jobs={jobs} />;
}
