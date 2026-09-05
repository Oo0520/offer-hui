"use client";

import { useRef, useState } from "react";
import type { JobView } from "@/lib/jobs";

type MatchResult = {
  job: JobView;
  score: number;
  reasons: string[];
};

// MVP 规则引擎画像（正式版将接入简历解析 + pgvector + LLM 理由）
const PROFILE = {
  cohort: "2027届",
  degree: "本科及以上",
  industries: [
    "信息传输、软件和信息技术服务业",
    "互联网/电子商务",
    "计算机软件",
    "计算机服务（系统/数据/维护/安全）",
    "电子技术/半导体/集成电路",
  ],
  cities: ["北京", "上海", "深圳", "杭州", "广州", "南京", "全国"],
  keywords: ["软件", "算法", "研发", "开发", "工程师", "数据分析", "IC", "嵌入式", "AI", "前端", "后端", "测试"],
};

function score(job: JobView): { score: number; reasons: string[] } {
  let s = 0;
  const reasons: string[] = [];
  if (job.cohort && job.cohort === PROFILE.cohort) {
    s += 35;
    reasons.push(`届别匹配（${job.cohort}）`);
  }
  if (job.degree && (job.degree.includes("本科") || job.degree.includes("不限"))) {
    s += 20;
    reasons.push(`学历要求符合（${job.degree}）`);
  }
  if (PROFILE.industries.some((i) => job.industry.includes(i) || i.includes(job.industry))) {
    s += 25;
    reasons.push(`行业方向契合（${job.industry}）`);
  }
  if (PROFILE.cities.includes(job.city)) {
    s += 15;
    reasons.push(`意向城市匹配（${job.city}）`);
  }
  const kwHit = PROFILE.keywords.filter((k) => job.title.includes(k));
  if (kwHit.length) {
    s += 10 * Math.min(kwHit.length, 2);
    reasons.push(`岗位方向命中（${kwHit.join("/")}）`);
  }
  return { score: Math.min(s, 100), reasons };
}

export default function MatchClient({ jobs }: { jobs: JobView[] }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [results, setResults] = useState<MatchResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function applyFile(name: string) {
    setFileName(name);
    setStatus("idle");
    setResults([]);
  }

  function runMatch(name?: string) {
    const fn = name ?? fileName;
    if (!fn) {
      alert("请先上传简历，或点击「使用示例简历」体验。");
      return;
    }
    if (name) setFileName(name);
    setStatus("running");
    // 模拟解析耗时
    setTimeout(() => {
      const scored = jobs
        .map((j) => ({ job: j, score: 0, reasons: [] as string[] }))
        .map((r) => {
          const { score: sc, reasons } = score(r.job);
          return { ...r, score: sc, reasons };
        })
        .filter((r) => r.score >= 30)
        .sort((a, b) => b.score - a.score || (a.job.deadlineDays ?? 999) - (b.job.deadlineDays ?? 999))
        .slice(0, 6);
      setResults(scored);
      setStatus("done");
    }, 800);
  }

  return (
    <div className="wrap">
      <div className="page-hero">
        <div>
          <h1 className="h-display">AI 岗位匹配</h1>
          <p>
            上传简历，从 {jobs.length} 个聚合岗位中智能筛选最适合你的机会，一键生成投递清单。
          </p>
          <div className="tags-row">
            <span>五维匹配</span>
            <span>本机处理不上传</span>
            <span>匹配理由一目了然</span>
          </div>
        </div>
      </div>

      <div className="match-grid">
        <div>
          {fileName ? (
            <div className="upload-done">
              <div className="u-ic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="m5 12 4 4L19 6" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h4>{fileName}</h4>
                <p>已载入 · 可以开始匹配（本机处理，不上传服务器）</p>
              </div>
              <button
                onClick={() => {
                  setFileName(null);
                  setResults([]);
                  setStatus("idle");
                }}
              >
                重新上传
              </button>
            </div>
          ) : (
            <div
              className="upload-zone glass"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) applyFile(e.dataTransfer.files[0].name);
              }}
            >
              <div className="u-ic">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h4>上传简历（PDF / Word）</h4>
              <p>点击选择文件，或拖拽到此处 · 简历仅用于本次匹配，不存入数据库</p>
              <div className="formats">
                <span>PDF</span>
                <span>DOC</span>
                <span>DOCX</span>
                <span>≤ 5MB</span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && applyFile(e.target.files[0].name)}
              />
            </div>
          )}

          <div style={{ marginTop: 16 }} className="orbital">
            <button className="inner" onClick={() => runMatch()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.2 2.2m8.4 8.4 2.2 2.2m0-12.8-2.2 2.2m-8.4 8.4-2.2 2.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {status === "running" ? "匹配中…" : "开始匹配"}
            </button>
          </div>

          <div className="cost-note glass">
            <h5>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#8b5cf6" strokeWidth="2" />
                <path d="M12 8v5M12 16.5v.5" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
              </svg>
              匹配维度
            </h5>
            <div className="step">
              <span className="n">1</span>届别 — 你是哪一届，岗位招哪一届
            </div>
            <div className="step">
              <span className="n">2</span>学历 — 本科 / 硕士 / 博士是否对口
            </div>
            <div className="step">
              <span className="n">3</span>行业 — 你意向的行业方向
            </div>
            <div className="step">
              <span className="n">4</span>城市 — 期望工作地点
            </div>
            <div className="step">
              <span className="n">5</span>岗位方向 — 研发 / 算法 / 运营 / 职能等
            </div>
          </div>

          <div className="match-list">
            {status === "running" && (
              <div className="match-card glass" style={{ justifyContent: "center", color: "rgba(183,198,194,.7)", fontSize: 13 }}>
                正在解析简历并检索岗位…
              </div>
            )}
            {status === "done" && results.length === 0 && (
              <div className="match-card glass" style={{ justifyContent: "center", color: "rgba(183,198,194,.7)", fontSize: 13 }}>
                未找到匹配度 ≥ 30% 的岗位，试试放宽画像（点击「使用示例简历」）后重试
              </div>
            )}
            {results.map((r) => (
              <div key={r.job.id} className="match-card glass">
                <div
                  className="score-ring"
                  style={{
                    background: `conic-gradient(${r.score >= 70 ? "#8b5cf6" : "#06b6d4"} 0 ${r.score * 3.6}deg, rgba(255,255,255,.06) ${r.score * 3.6}deg 360deg)`,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <b>{r.score}%</b>
                    <span>MATCH</span>
                  </div>
                </div>
                <div className="match-main">
                  <div className="mt">{r.job.title}</div>
                  <div className="mc">
                    {r.job.company} · {r.job.city} · {r.job.jobType}
                    {r.job.cohort ? ` · ${r.job.cohort}` : ""}
                  </div>
                  <div className="match-reason">
                    <b>匹配理由：</b>
                    {r.reasons.join("；")}。{r.job.salaryText ? `薪资 ${r.job.salaryText}。` : ""}
                    {r.job.deadlineDays !== null && r.job.deadlineDays >= 0
                      ? `距截止 ${r.job.deadlineDays} 天，建议尽快投递。`
                      : "无明确截止日期，招满即止。"}
                  </div>
                </div>
                <a
                  className="go"
                  style={{ flex: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 900, color: "#c4b5fd" }}
                  href={r.job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  投递
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M7 17 17 7M9 7h8v8" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="match-side">
          <div className="panel glass">
            <h4>
              <span className="dot"></span>匹配说明
            </h4>
            <p style={{ fontSize: 12, color: "rgba(183,198,194,.75)", lineHeight: 1.8 }}>
              匹配基于 <b style={{ color: "#c4b5fd" }}>届别、学历、行业、城市、岗位方向</b>{" "}
              五维评分，分数越高越契合。所有处理在本机完成，简历不会上传服务器。
            </p>
          </div>
          <div className="panel glass">
            <h4>
              <span className="dot"></span>示例简历
            </h4>
            <p style={{ fontSize: 12, color: "rgba(183,198,194,.75)", lineHeight: 1.8 }}>
              没有简历？用示例画像（2027 届 · 理工科 · 软件/AI 方向）体验完整匹配流程。
            </p>
            <button
              style={{
                marginTop: 12,
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(183,198,194,.3)",
                borderRadius: 9999,
                padding: "9px 20px",
                fontSize: 12,
                fontWeight: 800,
                color: "var(--offwhite)",
              }}
              onClick={() => {
                applyFile("示例简历.pdf");
                runMatch("示例简历.pdf");
              }}
            >
              使用示例简历
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
