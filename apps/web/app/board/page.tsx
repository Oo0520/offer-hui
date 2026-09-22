import BoardClient from "@/components/BoardClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "求职看板 · Offer派" };

// 全量岗位数据静态预渲染，用户看板状态客户端再拉
export const dynamic = "force-static";

export default async function BoardPage() {
  const jobs = await fetchAllJobs();
  return <BoardClient jobs={jobs} />;
}
