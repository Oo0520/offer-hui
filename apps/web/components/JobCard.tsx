"use client";

import type { JobView } from "@/lib/jobs";

const FAV_KEY = "offer_fav";
const BOARD_KEY = "offer_board";

export function readFavs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
}

function Heart({ on }: { on: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21s-7-6.1-7-11a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 5.5 2c0 4.9-7 11-7 11Z"
        stroke={on ? "#ca0013" : "#b7c6c2"}
        strokeWidth="2"
        strokeLinejoin="round"
        fill={on ? "#ca0013" : "none"}
      />
    </svg>
  );
}

function BoardIcon({ on }: { on: boolean }) {
  return on ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="m5 12 4 4L19 6" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="#b7c6c2" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function JobCard({
  job,
  fav,
  board,
  onToggleFav,
  onToggleBoard,
}: {
  job: JobView;
  fav: boolean;
  board: string | null;
  onToggleFav: (e: React.MouseEvent) => void;
  onToggleBoard: (e: React.MouseEvent) => void;
}) {
  const days = job.deadlineDays;
  const hot = days !== null && days >= 0 && days <= 3;
  const dday =
    days === null
      ? "未标截止"
      : days < 0
        ? "已截止"
        : days === 0
          ? "今天截止"
          : `剩 ${days} 天`;

  return (
    <a
      className="job-card glass"
      href={job.applyUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-id={job.id}
    >
      <button className={"fav-btn" + (fav ? " on" : "")} onClick={onToggleFav} aria-label="收藏">
        <Heart on={fav} />
      </button>
      <button
        className={"board-btn" + (board ? " on" : "")}
        onClick={onToggleBoard}
        aria-label={board ? "已加入待投，点击移除" : "加入待投"}
        title={board ? "已加入待投，点击移除" : "加入待投"}
      >
        <BoardIcon on={!!board} />
      </button>
      <span className="logo-badge gicon" style={{ background: job.bg }}>
        {job.lg}
      </span>
      <div className="job-main">
        <div className="job-title">
          <span className="tt">{job.title}</span>
        </div>
        <div className="job-tags">
          <span className={"jtag " + (job.jobType === "实习" ? "cy" : "rd")}>{job.jobType}</span>
          <span className="jtag gn">{job.source}</span>
          {job.cohort && <span className="jtag gn">{job.cohort}</span>}
          <span className="jtag gn">{job.industry}</span>
        </div>
        <div className="job-meta">
          {job.company}
          <span className="sep">·</span>
          {job.city}
          <span className="sep">·</span>
          {job.degree}
          {job.salaryText && (
            <>
              <span className="sep">·</span>
              {job.salaryText}
            </>
          )}
        </div>
        <div className="job-foot">
          <span className="src">
            {job.postedAt ? `发布 ${job.postedAt.slice(5)}` : job.source}
          </span>
          <span className="ops">
            <span className={"dday" + (hot ? " hot" : "")}>{dday}</span>
            <span className="go">
              官方投递
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M7 17 17 7M9 7h8v8" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </span>
        </div>
      </div>
    </a>
  );
}
