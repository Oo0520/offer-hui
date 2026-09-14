"use client";

import { useEffect, useMemo, useState } from "react";
import type { JobView } from "@/lib/jobs";
import JobCard from "./JobCard";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function FavoritesClient({ jobs }: { jobs: JobView[] }) {
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [boards, setBoards] = useState<Record<string, string>>({});

  useEffect(() => {
    // localStorage
    try {
      setFavs(new Set(JSON.parse(localStorage.getItem("offer_fav") || "[]")));
      setBoards(JSON.parse(localStorage.getItem("offer_board") || "{}"));
    } catch {}

    // 登录后从数据库同步
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) return;
      supabase.from("user_jobs").select("job_id, status").eq("user_id", u.id)
        .then(({ data: rows }) => {
          if (!rows) return;
          const f = new Set<string>();
          const b: Record<string, string> = {};
          for (const r of rows) {
            if (r.status === "star") f.add(r.job_id);
            else if (r.status === "pending") b[r.job_id] = "待投";
          }
          setFavs(f);
          setBoards(b);
        });
    });
  }, []);

  async function toggleFav(e: React.MouseEvent, jobId: string) {
    e.preventDefault(); e.stopPropagation();
    const on = !favs.has(jobId);
    const n = new Set(favs);
    if (on) n.add(jobId); else n.delete(jobId);
    setFavs(n);
    localStorage.setItem("offer_fav", JSON.stringify([...n]));
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      if (on) await supabase.from("user_jobs").upsert({ user_id: session.user.id, job_id: jobId, status: "star" }, { onConflict: "user_id,job_id,status" });
      else await supabase.from("user_jobs").delete().eq("user_id", session.user.id).eq("job_id", jobId).eq("status", "star");
    }
  }

  async function toggleBoard(e: React.MouseEvent, jobId: string) {
    e.preventDefault(); e.stopPropagation();
    const b = { ...boards };
    if (b[jobId]) delete b[jobId]; else b[jobId] = "待投";
    setBoards(b);
    localStorage.setItem("offer_board", JSON.stringify(b));
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      if (b[jobId]) await supabase.from("user_jobs").upsert({ user_id: session.user.id, job_id: jobId, status: "pending" }, { onConflict: "user_id,job_id,status" });
      else await supabase.from("user_jobs").delete().eq("user_id", session.user.id).eq("job_id", jobId).eq("status", "pending");
    }
  }

  const list = useMemo(() => {
    const byId = new Map(jobs.map((j) => [j.id, j]));
    return [...favs].map((id) => byId.get(id)).filter((x): x is JobView => !!x);
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
            <JobCard
              key={j.id}
              job={j}
              fav={favs.has(j.id)}
              board={boards[j.id] || null}
              onToggleFav={(e) => toggleFav(e, j.id)}
              onToggleBoard={(e) => toggleBoard(e, j.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
