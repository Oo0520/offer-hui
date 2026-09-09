"use client";

import { useState } from "react";

export default function AgentsClient({ mcpUrl }: { mcpUrl: string }) {
  const [copied, setCopied] = useState("");
  const webUrl = typeof window !== "undefined" ? window.location.origin : "";

  const command = `Read ${webUrl}/agents/skill.md and follow the instructions to set up the Offer派 MCP server. Then use it to help me track campus recruitment jobs, deadlines and applications.`;

  const mcpJson = JSON.stringify(
    {
      mcpServers: {
        offerp: {
          type: "http",
          url: mcpUrl,
        },
      },
    },
    null,
    2,
  );

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1600);
    });
  };

  return (
    <div className="wrap" style={{ maxWidth: 860, paddingTop: 36, paddingBottom: 80 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Offer派 · Agent 接入</h1>
      <p style={{ color: "#5a6a63", marginBottom: 32 }}>
        把你的 AI 助手接入 Offer派，随时查询校招/实习岗位、截止日期与数据来源。公益免费，公开只读。
      </p>

      {/* 1. 一键指令 */}
      <section
        style={{
          background: "#fff",
          border: "1px solid rgba(183,198,194,.3)",
          borderRadius: 24,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
          ① 给 Agent 的接入指令
        </h2>
        <p style={{ fontSize: 13, color: "#5a6a63", marginBottom: 10 }}>
          复制下面这条指令，发给你的 AI 助手（豆包 / Claude / Cursor / DeepSeek 等），它会自动完成接入：
        </p>
        <div
          style={{
            background: "#171e19",
            color: "#eeebe3",
            borderRadius: 16,
            padding: 16,
            fontSize: 13,
            lineHeight: 1.7,
            wordBreak: "break-all",
            position: "relative",
          }}
        >
          {command}
          <button
            onClick={() => copy(command, "cmd")}
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              background: copied === "cmd" ? "#10b981" : "#ca0013",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {copied === "cmd" ? "已复制 ✓" : "复制"}
          </button>
        </div>
      </section>

      {/* 2. 手动配置 */}
      <section
        style={{
          background: "#fff",
          border: "1px solid rgba(183,198,194,.3)",
          borderRadius: 24,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
          ② 手动配置（支持 MCP 的客户端）
        </h2>
        <p style={{ fontSize: 13, color: "#5a6a63", marginBottom: 10 }}>
          当前 MCP Server 地址：<code style={{ color: "#ca0013" }}>{mcpUrl}</code>
        </p>
        <div style={{ position: "relative" }}>
          <pre
            style={{
              background: "#f4f6f4",
              borderRadius: 16,
              padding: 16,
              fontSize: 12.5,
              lineHeight: 1.6,
              overflowX: "auto",
            }}
          >
            {mcpJson}
          </pre>
          <button
            onClick={() => copy(mcpJson, "json")}
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              background: copied === "json" ? "#10b981" : "#171e19",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {copied === "json" ? "已复制 ✓" : "复制"}
          </button>
        </div>
      </section>

      {/* 3. 工具说明 */}
      <section
        style={{
          background: "#fff",
          border: "1px solid rgba(183,198,194,.3)",
          borderRadius: 24,
          padding: 24,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>③ 可用工具</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "#5a6a63", textAlign: "left" }}>
              <th style={{ padding: "8px 12px", borderBottom: "1px solid rgba(183,198,194,.4)" }}>工具</th>
              <th style={{ padding: "8px 12px", borderBottom: "1px solid rgba(183,198,194,.4)" }}>作用</th>
              <th style={{ padding: "8px 12px", borderBottom: "1px solid rgba(183,198,194,.4)" }}>关键参数</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "10px 12px", fontWeight: 700 }}>query_jobs</td>
              <td style={{ padding: "10px 12px" }}>岗位列表 + 筛选 + 排序 + 分页</td>
              <td style={{ padding: "10px 12px" }}>city / cohort / degree / job_type / keyword</td>
            </tr>
            <tr>
              <td style={{ padding: "10px 12px", fontWeight: 700 }}>get_job_detail</td>
              <td style={{ padding: "10px 12px" }}>单个岗位完整详情</td>
              <td style={{ padding: "10px 12px" }}>job_id</td>
            </tr>
            <tr>
              <td style={{ padding: "10px 12px", fontWeight: 700 }}>get_sources</td>
              <td style={{ padding: "10px 12px" }}>数据源清单 + 岗位数</td>
              <td style={{ padding: "10px 12px" }}>-</td>
            </tr>
            <tr>
              <td style={{ padding: "10px 12px", fontWeight: 700 }}>get_stats</td>
              <td style={{ padding: "10px 12px" }}>全库统计</td>
              <td style={{ padding: "10px 12px" }}>-</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 12.5, color: "#5a6a63", marginTop: 16 }}>
          所有岗位数据均标注来源并跳转官方投递入口，本站不截留简历。接口公开只读，60 秒内最多 120 次调用。
        </p>
      </section>
    </div>
  );
}
