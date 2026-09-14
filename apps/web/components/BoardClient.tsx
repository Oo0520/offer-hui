"use client";

import { useEffect, useMemo, useState } from "react";
import type { JobView } from "@/lib/jobs";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const STAGES = ["待投", "已投", "笔试", "面试", "Offer"] as const;
type Stage = (typeof STAGES)[number];
const KEY = "offer_board";

// 中文阶段 -> 数据库 status
const STAGE_TO_STATUS: Record<string, string> = {
  "待投": "pending",
  "已投": "applied",
  "笔试": "written",
  "面试": "interview",
  "Offer": "offer",
};
const STATUS_TO_STAGE: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_TO_STATUS).map(([k, v]) => [v, k])
);

function readBoard(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export default function BoardClient({ jobs }: { jobs: JobView[] }) {
  const router = useRouter();
  const [stages, setStages] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<JobView | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);
  const [debug, setDebug] = useState("");

  useEffect(() => {
    // localStorage
    setStages(readBoard());

    // 登录后从数据库同步
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user;
      if (!u) {
        setDebug("未登录");
        return;
      }

      // 先把 localStorage 里的未同步数据上传到数据库
      const local = readBoard();
      const existing = await supabase.from("user_jobs").select("job_id, status").eq("user_id", u.id);
      const existingMap: Record<string, string> = {};
      if (existing.data) {
        for (const r of existing.data) {
          const st = STATUS_TO_STAGE[r.status];
          if (st) existingMap[r.job_id] = st;
        }
      }
      // 找出 localStorage 有但数据库没有的，上传
      for (const [jobId, stage] of Object.entries(local)) {
        if (!existingMap[jobId]) {
          await supabase.from("user_jobs").upsert({
            user_id: u.id, job_id: jobId, status: STAGE_TO_STATUS[stage],
          }, { onConflict: "user_id,job_id,status" });
        }
      }

      // 再从数据库读全部
      supabase.from("user_jobs").select("job_id, status").eq("user_id", u.id)
        .then(({ data: rows, error }) => {
          if (error) {
            setDebug(`查询错误: ${error.message}`);
            return;
          }
          if (!rows) return;
          const b: Record<string, string> = {};
          for (const r of rows) {
            const st = STATUS_TO_STAGE[r.status];
            if (st) b[r.job_id] = st;
          }
          setStages(b);
          setDebug(`同步完成: ${rows.length} 条`);
        });
    });

    // 监听登录状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) return;
      supabase.from("user_jobs").select("job_id, status").eq("user_id", session.user.id)
        .then(({ data: rows }) => {
          if (!rows) return;
          const b: Record<string, string> = {};
          for (const r of rows) {
            const st = STATUS_TO_STAGE[r.status];
            if (st) b[r.job_id] = st;
          }
          setStages(b);
        });
    });
    return () => subscription.unsubscribe();
  }, []);

  async function setStage(id: string, st: Stage) {
    const next = { ...stages, [id]: st };
    delete next[id];
    next[id] = st;
    localStorage.setItem(KEY, JSON.stringify(next));
    setStages(next);

    // 数据库：先删掉旧状态，再写入新状态
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      // 删掉所有状态
      await supabase.from("user_jobs").delete()
        .eq("user_id", session.user.id).eq("job_id", id);
      // 写入新状态
      await supabase.from("user_jobs").upsert({
        user_id: session.user.id, job_id: id, status: STAGE_TO_STATUS[st],
      }, { onConflict: "user_id,job_id,status" });
    }
  }

  const cols = useMemo(() => {
    return STAGES.map((st) => ({
      st,
      list: jobs.filter((j) => stages[j.id] === st),
    }));
  }, [jobs, stages]);

  const stats = useMemo(
    () =>
      STAGES.map((st) => ({
        st,
        n: jobs.filter((j) => stages[j.id] === st).length,
      })),
    [jobs, stages]
  );

  function openSheet(j: JobView) {
    setSheet(j);
  }
  function closeSheet() {
    setSheet(null);
  }

  return (
    <div className="wrap">
      <div className="page-hero">
        <div>
          <h1 className="h-display">求职看板</h1>
          <p>已投 / 待投 / 笔试 / 面试 / Offer 全流程进度管理，桌面拖拽、移动端点选改状态。</p>
          <div className="tags-row">
            <span>拖拽卡片到目标阶段</span>
            <span>移动端点击卡片改状态</span>
            <span>登录后自动云端同步</span>
          </div>
        </div>
        <div className="orbital">
          <button className="inner" onClick={() => router.push("/")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            从首页添加岗位
          </button>
        </div>
      </div>

      <div style={{padding: 12, marginBottom: 12, background: "rgba(139,92,246,0.1)", borderRadius: 12, fontSize: 12, color: "#c4b5fd"}}>
        调试: {debug || "加载中..."}
      </div>

      <div className="board-stats">
        {stats.map((s) => (
          <div key={s.st} className="st glass">
            <b>{s.n}</b>
            <span>{s.st}</span>
          </div>
        ))}
      </div>

      <div className="board">
        {cols.map(({ st, list }) => (
          <div
            key={st}
            className={"board-col glass" + (dropCol === st ? " drop" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setDropCol(st);
            }}
            onDragLeave={() => setDropCol(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDropCol(null);
              if (dragId) setStage(dragId, st as Stage);
            }}
          >
            <h5>
              {st}
              <span className="cnt">{list.length}</span>
            </h5>
            {list.length === 0 ? (
              <div style={{ fontSize: 11, color: "rgba(183,198,194,.4)", textAlign: "center", padding: "22px 0", lineHeight: 1.6 }}>
                {st === "待投" ? "去首页点「+ 待投」\n添加岗位到看板" : "暂无岗位"}
              </div>
            ) : (
              list.map((j) => (
                <div
                  key={j.id}
                  className={"bd-card" + (dragId === j.id ? " dragging" : "")}
                  draggable
                  onDragStart={() => setDragId(j.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => openSheet(j)}
                >
                  <div className="bt">{j.title}</div>
                  <div className="bc">
                    {j.company} · {j.city}
                  </div>
                  <div className="bd-row">
                    <span>{j.deadlineAt || "未标截止"}</span>
                    <span
                      className="chg"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSheet(j);
                      }}
                    >
                      改状态 ›
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      {/* 移动端阶段弹层 */}
      <div
        className={"stage-mask" + (sheet ? " open" : "")}
        onClick={closeSheet}
      />
      <div className={"stage-sheet" + (sheet ? " open" : "")}>
        {sheet && (
          <>
            <h5>
              {sheet.company} · {sheet.title}
            </h5>
            <div>
              {STAGES.map((st) => (
                <button
                  key={st}
                  className={(stages[sheet.id] || "待投") === st ? "on" : ""}
                  onClick={() => {
                    setStage(sheet.id, st);
                    closeSheet();
                  }}
                >
                  {st}
                  {(stages[sheet.id] || "待投") === st ? " · 当前" : ""}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
