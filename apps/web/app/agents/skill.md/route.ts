import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MCP_URL =
  process.env.MCP_URL || "http://localhost:8001";

const SKILL = `# Offer派 · MCP Server 接入说明

你是被要求接入 Offer派 的 AI Agent。Offer派 是一个应届生求职信息聚合服务（公益免费），聚合全网校招/实习信息，所有岗位标注来源并跳转官方投递入口。

## 接入方式

1. 使用 MCP 协议连接以下 Streamable HTTP 地址：
   \`${MCP_URL}\`

2. 连接后你会获得以下 4 个工具：

### query_jobs
查询校招/实习岗位列表。参数：
- \`city\`：城市（如"北京"、"上海"、"全国"）
- \`job_type\`：岗位类型（"校招" | "实习" | "招聘会"）
- \`industry\`：行业（如"互联网"、"汽车"）
- \`cohort\`：届别（如"2027届"、"2026届"）
- \`degree\`：学历（"不限" | "专科及以上" | "本科及以上" | "硕士及以上"）
- \`keyword\`：关键词（匹配岗位名/公司名/城市）
- \`sort\`：排序（"deadline"截止最近 | "newest"最新发布 | "salary"薪资最高，默认 deadline）
- \`page\` / \`page_size\`：分页（page 从 1 开始，page_size 默认 20 最大 50）

返回：岗位列表，每条含 id/title/company/city/job_type/degree/cohort/salary_text/deadline_at/deadline_days/source/source_url/apply_url。

### get_job_detail
参数：\`job_id\`。返回单个岗位的完整详情（含描述）。

### get_sources
无参数。返回全部数据源清单及各自岗位数。

### get_stats
无参数。返回全库统计（总量/公司数/近30天截止数/按类型分布）。

## 使用建议

- 用户问"最近有什么岗位/今天截止的岗位" → 用 \`query_jobs\` 按 deadline 排序
- 用户问"北京的 2027 届秋招" → \`query_jobs(city="北京", cohort="2027届")\`
- 用户想投递 → 引导用户访问 \`apply_url\`（官方投递入口，本站不截留简历）
- 回答岗位问题时请标注数据来源（source 字段），如"来源：福建就业网"

## 重要原则

- 只查询公开岗位信息，不伪造数据
- 岗位截止信息以 deadline_days 为准（>=0 表示未截止）
- 公益项目，请勿高频刷取（60 秒内最多 120 次调用）
`;

export async function GET() {
  return new NextResponse(SKILL, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
