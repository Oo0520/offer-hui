"use client";

import { useEffect, useMemo, useState } from "react";
import type { JobView } from "@/lib/jobs";
import JobCard from "./JobCard";
import { readFavs } from "./JobCard";
import Link from "next/link";

export default function FavoritesClient({ jobs }: { jobs: JobView[] }) {
  const [favs, setFavs] = useState<string[]>([]);

  useEffect(() => {
    setFavs(readFavs());
    const on = () => setFavs(readFavs());
    window.addEventListener("storage", on);
    window.addEventListener("offer-fav", on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener("offer-fav", on);
    };
  }, []);

  const list = useMemo(() => {
    const byId = new Map(jobs.map((j) => [j.id, j]));
    return favs.map((id) => byId.get(id)).filter((x): x is JobView => !!x);
  }, [jobs, favs]);

  const urgent = list.filter(
    (j) => j.deadlineDays !== null && j.deadlineDays >= 0 && j.deadlineDays <= 7
  ).length;

  return (
    <div className="wrap">
      <div className="page-hero" style={{ marginTop: 24 }}>
        <div>
          <h1 className="h-display">我的收藏</h1>
          <p>收藏心仪岗位，统一管理投递节奏。</p>
        </div>
      </div>
      <div className="fav-stats">
        <div className="st glass">
          <b>{list.length}</b>
          <span>已收藏</span>
        </div>
        <div className="st glass">
          <b>{urgent}</b>
          <span>7 天内截止</span>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty glass">
          <div className="e-ic">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 21s-7-6.1-7-11a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 5.5 2c0 4.9-7 11-7 11Z" stroke="#8b5cf6" strokeWidth="2" />
            </svg>
          </div>
          <h3>还没有收藏岗位</h3>
          <p>在首页岗位卡右上角点击 ♥ 即可收藏</p>
          <Link href="/">去逛逛</Link>
        </div>
      ) : (
        <div className="job-grid">
          {list.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}
