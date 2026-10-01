"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JobView } from "@/lib/jobs";
import {
  AIConfig,
  AIMatchItem,
  callAI,
  clearConfig,
  loadConfig,
  normalizeBaseUrl,
  parseResumeFile,
  ruleEngine,
  SAMPLE_RESUME,
  saveConfig,
} from "@/lib/aiMatch";

type MatchResult = {
  job: JobView;
  score: number;
  reasons: string[];
};

type Mode = "rule" | "ai";

export default function MatchClient({ jobs }: { jobs: JobView[] }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [results, setResults] = useState<MatchResult[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("rule");
  const [showSettings, setShowSettings] = useState(false);
  const [configDraft, setConfigDraft] = useState<AIConfig>({
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    model: "deepseek-chat",
  });
  const [configSaved, setConfigSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = loadConfig();
    if (c) {
      setConfigDraft(c);
      setConfigSaved(true);
    }
  }, []);

  const applyFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStatus("idle");
    setResults([]);
    setErrMsg(null);
    try {
      const text = await parseResumeFile(file);
      setResumeText(text);
    } catch (e) {
      setResumeText(null);
      setErrMsg((e as Error).message);
    }
  }, []);

  function saveSettings() {
    const baseUrl = normalizeBaseUrl(configDraft.baseUrl);
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      setErrMsg("BaseURL 需要以 http:// 或 https:// 开头");
      return;
    }
    if (!configDraft.apiKey.trim()) {
      setErrMsg("请填写 API Key");
      return;
    }
    if (!configDraft.model.trim()) {
      setErrMsg("请填写模型名");
      return;
    }
    const c = { ...configDraft, baseUrl, apiKey: configDraft.apiKey.trim(), model: configDraft.model.trim() };
    saveConfig(c);
    setConfigSaved(true);
    setErrMsg(null);
  }

  function clearSettings() {
    clearConfig();
    setConfigSaved(false);
    setConfigDraft({ baseUrl: "https://api.deepseek.com/v1", apiKey: "", model: "deepseek-chat" });
    setErrMsg(null);
  }

  function runRule() {
    const scored = ruleEngine(jobs, 6);
    setResults(scored);
    setMode("rule");
    setStatus("done");
    if (!scored.length) setErrMsg("未找到匹配度 ≥ 30% 的岗位，试试放宽画像后重试");
  }

  async function runMatch(name?: string) {
    const fn = name ?? fileName;
    if (!fn) {
      alert("请先上传简历，或点击「使用示例简历」体验。");
      return;
    }
    if (name) {
      setFileName(name);
      setResumeText(SAMPLE_RESUME);
    }
    setErrMsg(null);
    setStatus("running");

    const config = loadConfig();
    const text = name ? SAMPLE_RESUME : resumeText;

    if (config && text) {
      const pool = ruleEngine(jobs, 15);
      if (pool.length) {
        try {
          const items = await callAI(config, text, pool.map((r) => r.job));
          const byId = new Map(pool.map((r) => [r.job.id, r.job]));
          const merged = items
            .map((it: AIMatchItem) => ({ job: byId.get(it.id), score: it.score, reasons: it.reasons }))
            .filter((r): r is MatchResult => !!r.job)
            .sort((a, b) => b.score - a.score || (a.job.deadlineDays ?? 999) - (b.job.deadlineDays ?? 999))
            .slice(0, 6);
          if (merged.length) {
            setResults(merged);
            setMode("ai");
            setStatus("done");
            return;
          }
          setErrMsg("模型未返回有效岗位结果，已降级为规则匹配");
        } catch (e) {
          const ae = e as { kind?: string; message?: string };
          setErrMsg(`AI 匹配失败（${ae.kind ?? "error"}）：${ae.message ?? "未知错误"}。已自动降级为规则匹配。`);
        }
      } else {
        setErrMsg("规则初筛未找到候选岗位，已降级为规则匹配");
      }
    } else if (!config && text) {
      setErrMsg("未配置 AI 模型，本次使用本地规则匹配。可展开右侧「AI 设置」填入你的 API Key 获得更智能的匹配。");
    }

    runRule();
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
            <span>简历本机解析</span>
            <span>支持自定义大模型 API</span>
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
                <p>
                  {resumeText
                    ? `已解析 ${resumeText.length} 字 · 仅本机处理，不上传我方服务器${configSaved ? "" : "（未配置 AI 时将用规则匹配）"}`
                    : errMsg ?? "解析失败，可重新上传"}
                </p>
              </div>
              <button
                onClick={() => {
                  setFileName(null);
                  setResumeText(null);
                  setResults([]);
                  setStatus("idle");
                  setErrMsg(null);
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
                if (e.dataTransfer.files.length) applyFile(e.dataTransfer.files[0]);
              }}
            >
              <div className="u-ic">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h4>上传简历（PDF / Word）</h4>
              <p>点击选择文件，或拖拽到此处 · 简历仅在本机解析，不存入数据库</p>
              <div className="formats">
                <span>PDF</span>
                <span>DOCX</span>
                <span>≤ 5MB</span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && applyFile(e.target.files[0])}
              />
            </div>
          )}

          <div style={{ marginTop: 16 }} className="orbital">
            <button className="inner" onClick={() => runMatch()} disabled={status === "running"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.2 2.2m8.4 8.4 2.2 2.2m0-12.8-2.2 2.2m-8.4 8.4-2.2 2.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {status === "running" ? "匹配中…" : "开始匹配"}
            </button>
          </div>

          {errMsg && (
            <div className="ai-note glass" style={{ color: "rgba(248,113,113,.95)", marginBottom: 12 }}>
              {errMsg}
            </div>
          )}

          {mode === "ai" && status === "done" && (
            <div className="ai-note glass" style={{ marginBottom: 12 }}>
              ✦ 本次匹配由你配置的 AI 模型完成（{configDraft.model}）
            </div>
          )}

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
                正在解析简历并匹配岗位…
              </div>
            )}
            {status === "done" && results.length === 0 && (
              <div className="match-card glass" style={{ justifyContent: "center", color: "rgba(183,198,194,.7)", fontSize: 13 }}>
                未找到匹配岗位，试试「使用示例简历」或调整 AI 配置后重试
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
            <h4
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
              onClick={() => setShowSettings((s) => !s)}
            >
              <span className="dot"></span>AI 设置
              <span style={{ fontSize: 11, color: "rgba(183,198,194,.6)" }}>
                {configSaved ? `已配置 · ${configDraft.model}` : "未配置"}
                {showSettings ? " ▾" : " ▸"}
              </span>
            </h4>
            {showSettings && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "rgba(183,198,194,.7)" }}>BaseURL（OpenAI 兼容）</label>
                  <input
                    className="ai-input"
                    value={configDraft.baseUrl}
                    onChange={(e) => setConfigDraft({ ...configDraft, baseUrl: e.target.value })}
                    placeholder="https://api.deepseek.com/v1"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "rgba(183,198,194,.7)" }}>API Key</label>
                  <input
                    className="ai-input"
                    type="password"
                    value={configDraft.apiKey}
                    onChange={(e) => setConfigDraft({ ...configDraft, apiKey: e.target.value })}
                    placeholder="sk-…"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "rgba(183,198,194,.7)" }}>模型</label>
                  <input
                    className="ai-input"
                    value={configDraft.model}
                    onChange={(e) => setConfigDraft({ ...configDraft, model: e.target.value })}
                    placeholder="deepseek-chat"
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="ai-btn primary" onClick={saveSettings}>
                    保存
                  </button>
                  {configSaved && (
                    <button className="ai-btn" onClick={clearSettings}>
                      清除
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "rgba(183,198,194,.55)", lineHeight: 1.7, marginTop: 2 }}>
                  支持任意 OpenAI 兼容接口（DeepSeek / 硅基流动 / Kimi / 通义等）。Key 仅存于本浏览器、直连你自己的 API，不上传我方服务器。未配置时自动使用本地规则匹配。
                </p>
              </div>
            )}
          </div>
          <div className="panel glass">
            <h4>
              <span className="dot"></span>匹配说明
            </h4>
            <p style={{ fontSize: 12, color: "rgba(183,198,194,.75)", lineHeight: 1.8 }}>
              上传简历后本机解析内容；已配置 AI 时由你的模型逐岗位评分并给理由，未配置时按{" "}
              <b style={{ color: "#c4b5fd" }}>届别、学历、行业、城市、岗位方向</b> 五维规则评分。
              简历内容不会上传我方服务器。
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
              onClick={() => runMatch("示例简历.pdf")}
            >
              使用示例简历
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
