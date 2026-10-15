import HomeClient from "@/components/HomeClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "Offer派 · 岗位聚合" };

// build 时静态预渲染，数据打包在 HTML 里，访问速度最快
export const dynamic = "force-static";

export default async function HomePage() {
  const jobs = await fetchAllJobs();
  const companies = new Set(jobs.map((j) => j.company)).size;
  // 注意：这里**不能**算「30 天内截止数」——本页是 force-static，
  // 服务端算出的天数会被页面缓存冻住（2026-10-15 事故：页面停留在前一天，
  // 把已截止的 8 条显示成「今天截止」）。该数字与所有截止相关展示
  // 都改由客户端按访问者当天现算（HomeClient 内的 useFreshDeadlines）。
  return <HomeClient jobs={jobs} stats={{ total: jobs.length, companies }} />;
}
