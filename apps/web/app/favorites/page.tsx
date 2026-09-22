import FavoritesClient from "@/components/FavoritesClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "我的收藏 · Offer派" };

// 全量岗位数据静态预渲染，用户收藏状态客户端再拉
export const dynamic = "force-static";

export default async function FavoritesPage() {
  const jobs = await fetchAllJobs();
  return <FavoritesClient jobs={jobs} />;
}
