import CalendarClient from "@/components/CalendarClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "校招日历 · Offer派" };

// 依赖实时数据（Supabase），禁止构建期静态预渲染
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const jobs = await fetchAllJobs();
  return <CalendarClient jobs={jobs} />;
}
