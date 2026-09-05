"use client";

import { useEffect, useMemo, useState } from "react";
import type { JobView } from "@/lib/jobs";
import { useRouter } from "next/navigation";

const STAGES = ["待投", "已投", "笔试", "面试", "Offer"] as const;
type Stage = (typeof STAGES)[number];
const KEY = "offer_board";

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

  useEffect(() => {
    setStages(readBoard());
    const sync = () => setStages(readBoard());
    window.addEventListener("offer-board", sync);
    return () => window.removeEventListener("offer-board", sync);
  }, []);

  function setStage(id: string, st: Stage) {
    const next = { ...readBoard(), [id]: st };
    localStorage.setItem(KEY, JSON.stringify(next));
    setStages(next);
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
            <span>进度保存在本地浏览器</span>
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
