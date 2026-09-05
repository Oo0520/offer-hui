import CalendarClient from "@/components/CalendarClient";
export const dynamic = "force-dynamic";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "校招日历 · Offer汇" };

export default async function CalendarPage() {
  const jobs = await fetchAllJobs();
  return <CalendarClient jobs={jobs} />;
}
