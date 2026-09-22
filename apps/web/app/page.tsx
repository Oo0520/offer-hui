import HomeClient from "@/components/HomeClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "Offer派 · 岗位聚合" };

// build 时静态预渲染，数据打包在 HTML 里，访问速度最快
export const dynamic = "force-static";

export default async function HomePage() {
  const jobs = await fetchAllJobs();
  const companies = new Set(jobs.map((j) => j.company)).size;
  const due30 = jobs.filter(
    (j) => j.deadlineDays !== null && j.deadlineDays >= 0 && j.deadlineDays <= 30
  ).length;
  return (
    <HomeClient
      jobs={jobs}
      stats={{ total: jobs.length, companies, due30 }}
    />
  );
}
