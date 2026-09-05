import CalendarClient from "@/components/CalendarClient";
import { fetchAllJobs } from "@/lib/jobs";

export const metadata = { title: "校招日历 · Offer派" };

export default async function CalendarPage() {
  const jobs = await fetchAllJobs();
  return <CalendarClient jobs={jobs} />;
}
