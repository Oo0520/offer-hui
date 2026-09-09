"use client";

import { useState, useEffect, useRef } from "react";

const AI_TOOLS = ["Codex", "Claude", "Kimi", "DeepSeek Harness", "Gemini", "豆包"];

export default function AgentsClient({ mcpUrl }: { mcpUrl: string }) {
  const [copied, setCopied] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const secRefs = useRef<(HTMLElement | null)[]>([]);

  // SSR/客户端一致：origin 只在客户端填充，避免 hydration 文本不匹配
  useEffect(() => {
    setWebUrl(window.location.origin);
  }, []);

  const command = `Read ${webUrl}/agents/skill.md and follow the instructions to set up the Offer派 MCP server. Then use it to help me track campus recruitment jobs, deadlines and applications.`;

  const mcpJson = JSON.stringify(
    { mcpServers: { offerp: { type: "http", url: mcpUrl } } },
    null,
    2,
  );

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1600);
    });
  };

  // 滚动淡入
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          }
        });
      },
      { threshold: 0.08 },
    );
    secRefs.current.forEach((el) => el && io.observe(el));
    if (!("IntersectionObserver" in window)) {
      secRefs.current.forEach((el) => {
        if (el) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        }
      });
    }
    return () => io.disconnect();
  }, []);

  // mcp.json 语法着色渲染
  const renderJson = () => {
    const lines = mcpJson.split("\n");
    return lines.map((line, i) => {
      const indent = line.match(/^\s*/)![0];
      const rest = line.trim();
      if (rest.includes('"url"')) {
        const m = rest.match(/("url":\s*")([^"]*)(")/);
        if (m)
          return (
            <div key={i}>
              {indent}
              <span style={{ color: "#67e8f9" }}>{m[1]}</span>
              <span style={{ color: "#f87171" }}>{m[2]}</span>
              <span style={{ color: "#67e8f9" }}>{m[3]}</span>
            </div>
          );
      }
      const keyMatch = rest.match(/^("[^"]+":)(.*)$/);
      if (keyMatch)
        return (
          <div key={i}>
            {indent}
            <span style={{ color: "#67e8f9" }}>{keyMatch[1]}</span>
            <span style={{ color: "#eeebe3" }}>{keyMatch[2]}</span>
          </div>
        );
      return (
        <div key={i}>
          {indent}
          <span style={{ color: "#eeebe3" }}>{rest}</span>
        </div>
      );
    });
  };

  const sec = (i: number) => (el: HTMLElement | null) => {
    secRefs.current[i] = el;
  };

  const stepBadge = (n: string) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 30,
        height: 30,
        borderRadius: 10,
        background: "linear-gradient(135deg,#8b5cf6,#06b6d4)",
        color: "#fff",
        fontSize: 14,
        fontWeight: 900,
        marginRight: 12,
        boxShadow: "0 4px 14px -4px rgba(139,92,246,.5)",
      }}
    >
      {n}
    </span>
  );

  const copyBtn = (key: string, dark: boolean) => (
    <button
      onClick={() => copy(key === "cmd" ? command : mcpJson, key)}
      style={{
        flex: "none",
        background: copied === key ? "#10b981" : dark ? "#ca0013" : "rgba(202,0,19,.9)",
        color: "#fff",
        border: "none",
        borderRadius: 999,
        padding: "7px 16px",
        fontSize: 12.5,
        fontWeight: 800,
        cursor: "pointer",
        transition: "background .2s ease",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background =
          copied === key ? "#10b981" : "#a30010")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background =
          copied === key ? "#10b981" : dark ? "#ca0013" : "rgba(202,0,19,.9)")
      }
    >
      {copied === key ? "已复制 ✓" : "复制"}
    </button>
  );

  return (
    <div
      className="wrap"
      style={{ maxWidth: 880, paddingTop: 30, paddingBottom: 90 }}
    >
      {/* Hero */}
      <div style={{ marginBottom: 34 }}>
        <span
          className="label"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: "#b7c6c2",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#ca0013",
              boxShadow: "0 0 0 3px rgba(202,0,19,.25)",
            }}
          />
          Agent 接入 · MCP
        </span>
        <h1
          className="h-display"
          style={{ fontSize: 30, marginTop: 12, marginBottom: 10 }}
        >
          Offer派 · Agent 接入
        </h1>
        <p style={{ fontSize: 13.5, color: "rgba(238,235,227,.66)", maxWidth: 620 }}>
          把你的 AI 助手接入 Offer派，随时查询校招/实习岗位、截止日期与数据来源。公益免费，公开只读。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          {AI_TOOLS.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: "5px 14px",
                borderRadius: 9999,
                border: "1px solid rgba(183,198,194,.3)",
                color: "rgba(238,235,227,.75)",
                background: "rgba(255,255,255,.03)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ① 一键指令 */}
      <section
        ref={sec(0)}
        className="glass"
        style={{ padding: 26, marginBottom: 18, opacity: 0, transform: "translateY(30px)", transition: "opacity .55s ease, transform .55s ease" }}
      >
        <h2
          className="h-sub"
          style={{ display: "flex", alignItems: "center", marginBottom: 12 }}
        >
          {stepBadge("1")}
          一键接入指令
        </h2>
        <p style={{ fontSize: 13, color: "rgba(238,235,227,.6)", marginBottom: 14, marginLeft: 42 }}>
          复制下面这条指令，发给你的 AI 助手（Codex / Claude / Kimi / DeepSeek Harness / Gemini / 豆包），它会自己读取接入文档完成配置：
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            background: "#10150f",
            border: "1px solid rgba(183,198,194,.16)",
            borderRadius: 24,
            padding: "16px 16px 16px 20px",
          }}
        >
          <code
            style={{
              flex: 1,
              fontSize: 13,
              lineHeight: 1.7,
              color: "#eeebe3",
              wordBreak: "break-all",
              minWidth: 0,
            }}
          >
            {command}
          </code>
          {copyBtn("cmd", true)}
        </div>
      </section>

      {/* ② 手动配置 */}
      <section
        ref={sec(1)}
        className="glass"
        style={{ padding: 26, marginBottom: 18, opacity: 0, transform: "translateY(30px)", transition: "opacity .55s ease, transform .55s ease" }}
      >
        <h2
          className="h-sub"
          style={{ display: "flex", alignItems: "center", marginBottom: 12 }}
        >
          {stepBadge("2")}
          手动配置（支持 MCP 的客户端）
        </h2>
        <p style={{ fontSize: 13, color: "rgba(238,235,227,.6)", marginBottom: 8, marginLeft: 42 }}>
          当前 MCP Server 地址：
        </p>
        <p style={{ marginLeft: 42, marginBottom: 14 }}>
          <code
            style={{
              color: "#f87171",
              fontSize: 13,
              fontWeight: 800,
              background: "rgba(248,113,113,.08)",
              padding: "3px 10px",
              borderRadius: 8,
              wordBreak: "break-all",
            }}
          >
            {mcpUrl}
          </code>
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            background: "#10150f",
            border: "1px solid rgba(183,198,194,.16)",
            borderRadius: 24,
            padding: 16,
            marginLeft: 42,
          }}
        >
          <pre
            style={{
              flex: 1,
              fontSize: 12.5,
              lineHeight: 1.7,
              margin: 0,
              overflowX: "auto",
              color: "#eeebe3",
              minWidth: 0,
            }}
          >
            {renderJson()}
          </pre>
          {copyBtn("json", false)}
        </div>
      </section>

      {/* ③ 可用工具 */}
      <section ref={sec(2)} className="glass" style={{ padding: 26, opacity: 0, transform: "translateY(30px)", transition: "opacity .55s ease, transform .55s ease" }}>
        <h2
          className="h-sub"
          style={{ display: "flex", alignItems: "center", marginBottom: 16 }}
        >
          {stepBadge("3")}
          可用工具
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "rgba(183,198,194,.7)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid rgba(183,198,194,.16)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase" }}>工具</th>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid rgba(183,198,194,.16)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase" }}>作用</th>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid rgba(183,198,194,.16)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase" }}>关键参数</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["query_jobs", "岗位列表 + 筛选 + 排序 + 分页", "city / cohort / degree / job_type / keyword"],
                ["get_job_detail", "单个岗位完整详情", "job_id"],
                ["get_sources", "数据源清单 + 岗位数", "—"],
                ["get_stats", "全库统计", "—"],
              ].map((r) => (
                <tr key={r[0]}>
                  <td style={{ padding: "11px 12px", fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>{r[0]}</td>
                  <td style={{ padding: "11px 12px", color: "rgba(238,235,227,.75)" }}>{r[1]}</td>
                  <td style={{ padding: "11px 12px", color: "rgba(183,198,194,.65)", fontSize: 12 }}>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "rgba(183,198,194,.6)", marginTop: 16 }}>
          所有岗位数据均标注来源并跳转官方投递入口，本站不截留简历。接口公开只读，60 秒内最多 120 次调用。
        </p>
      </section>
    </div>
  );
}
