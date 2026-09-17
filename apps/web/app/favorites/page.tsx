import FavoritesClient from "@/components/FavoritesClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "我的收藏 · Offer派" };

// 依赖实时数据（Supabase），禁止构建期静态预渲染
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const jobs = await fetchAllJobs();
  return <FavoritesClient jobs={jobs} />;
}
