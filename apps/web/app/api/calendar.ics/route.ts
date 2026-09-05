import { fetchAllJobs } from "@/lib/jobs";
import { NextResponse } from "next/server";

// 服务端动态生成 ICS 订阅文件，手机日历通过 URL 订阅后自动同步
export const revalidate = 300;

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export async function GET() {
  const jobs = await fetchAllJobs();
  // 未来 90 天内有明确截止日期的岗位
  const soon = jobs
    .filter(
      (j) =>
        j.deadlineAt &&
        j.deadlineDays !== null &&
        j.deadlineDays >= 0 &&
        j.deadlineDays <= 90,
    )
    .sort((a, b) => (a.deadlineDays || 0) - (b.deadlineDays || 0));

  const dtstamp =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OfferHui//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Offer汇 校招截止提醒",
    "X-WR-TIMEZONE:Asia/Shanghai",
    "X-WR-CALDESC:Offer汇聚合的校招/实习岗位截止日期提醒",
  ];

  for (const j of soon) {
    const date = (j.deadlineAt || "").replace(/-/g, "");
    const summary = `截止提醒 · ${j.title}（${j.company}）`;
    const desc = `${j.company} · ${j.city} · ${j.jobType}${j.cohort ? " · " + j.cohort : ""}\\n投递入口: ${j.applyUrl || ""}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${j.id}@offerhui`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(desc)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="offerhui-ddl.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
