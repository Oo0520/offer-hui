import type { Metadata } from "next";
import AgentsClient from "@/components/AgentsClient";

export const metadata: Metadata = {
  title: "Agent 接入 - Offer派",
  description: "把你的 AI 助手接入 Offer派，查询校招/实习岗位、截止日期与数据来源。",
};

const MCP_URL = process.env.MCP_URL || "http://localhost:8001";

export default function AgentsPage() {
  return <AgentsClient mcpUrl={MCP_URL} />;
}
