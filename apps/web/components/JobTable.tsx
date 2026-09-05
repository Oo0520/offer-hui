import type { JobView } from "@/lib/jobs";

const HEAD = [
  "公司名称",
  "数据来源",
  "所属行业",
  "招聘类型",
  "招聘对象",
  "工作地点",
  "薪资",
  "更新时间",
  "投递截止",
  "链接",
];

export default function JobTable({ jobs }: { jobs: JobView[] }) {
  return (
    <table className="job-table">
      <thead>
        <tr>
          {HEAD.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {jobs.map((j) => (
          <tr key={j.id}>
            <td>
              <span className="t-co">
                <i style={{ background: j.bg }}>{j.lg}</i>
                {j.company}
              </span>
            </td>
            <td>{j.source}</td>
            <td>{j.industry}</td>
            <td>{j.jobType}</td>
            <td>
              {j.degree}
              {j.cohort ? ` · ${j.cohort}` : ""}
            </td>
            <td>{j.city}</td>
            <td>{j.salaryText || "—"}</td>
            <td>{j.postedAt ? j.postedAt.slice(5) : "—"}</td>
            <td>{j.deadlineAt || "未标注"}</td>
            <td>
              <a
                className="t-link"
                href={j.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                投递
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                  <path d="M7 17 17 7M9 7h8v8" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
