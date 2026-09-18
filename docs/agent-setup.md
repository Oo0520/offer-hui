# Agent 接入文档（MCP）— Offer派

> 本文档说明如何把 Offer派 的岗位数据通过 MCP 协议接入任意 AI Agent（豆包 / Claude / Codex / DeepSeek / Kimi / Cursor 等）。
> 面向对象：本项目维护者、后续协作 agent、希望接入 Offer派 数据的开发者。
> 对应实现：`apps/mcp/server.py`；用户侧接入说明（skill 模板）见 `/agents/skill.md`（动态生成）。

---

## 1. 概述

Offer派 提供一层 **MCP Server（Streamable HTTP）**，把云端 Supabase 里的校招 / 实习 / 招聘会岗位以 4 个工具暴露给 Agent，支持按城市 / 届别 / 学历 / 类型 / 关键词筛选、截止排序、分页与详情查询。所有岗位数据均标注来源并携带官方投递入口，Agent 只查询、不修改数据。

**核心原则**：Agent 回答岗位问题时必须标注数据来源（`source` 字段）；引导用户跳转 `apply_url` 官方入口，本站不截留简历。

## 2. 架构与位置

```
apps/mcp/
├── server.py          # FastMCP Server（4 个工具，Streamable HTTP）
├── requirements.txt   # 依赖：fastmcp / psycopg[binary] / python-dotenv
├── start.bat          # Windows 启动脚本（复用 apps/worker/.venv）
├── smoke_test.py      # 冒烟测试（连通性）
└── full_test.py       # 全量工具测试
```

- **传输**：Streamable HTTP，默认监听 `0.0.0.0:8001`（`--port` 可改）。
- **数据源**：直连 Supabase Postgres，读取 `apps/worker/.env` 中的 `DATABASE_URL`（psycopg 直连，复用 worker 环境变量，**不新增第三套存储**）。
- **与前端的关系**：前端 `apps/web/app/agents/` 提供 `/agents` 分发页与 `/agents/skill.md`（动态生成，`MCP_URL` 取自 `apps/web/.env.local`，默认 `http://localhost:8001`）。
- **限流**：进程内滑动窗口，60 秒最多 120 次工具调用，超出返回明确错误。

## 3. 快速开始（本地运行）

### 3.1 前置条件

- `apps/worker/.env` 已配置 `DATABASE_URL`（psycopg 直连串），且 Supabase `jobs` 表有数据。
- 依赖已安装：直接复用 `apps/worker/.venv`（已装 fastmcp），或新建虚拟环境执行：

```bash
pip install -r apps/mcp/requirements.txt
```

### 3.2 启动

```bash
# Windows（复用 worker venv）
apps/mcp\start.bat

# 或任意平台
python apps/mcp/server.py            # 默认 0.0.0.0:8001
python apps/mcp/server.py --port 9001
```

启动成功输出：`Offer派 MCP Server 启动: 0.0.0.0:8001 (Streamable HTTP)`

### 3.3 验证

```bash
python apps/mcp/smoke_test.py   # 连通性 + 基本查询
python apps/mcp/full_test.py    # 4 个工具全量验证（13/13 通过为正常）
```

## 4. 工具清单

| 工具 | 用途 | 关键参数 | 返回 |
|---|---|---|---|
| `query_jobs` | 筛选 + 排序 + 分页查岗位 | `city` / `job_type` / `industry` / `cohort` / `degree` / `keyword` / `sort` / `page` / `page_size` | `{total, page, page_size, jobs[]}` |
| `get_job_detail` | 按 ID 查单条详情 | `job_id` | 岗位完整字段 + `description`（截断 500 字） |
| `get_sources` | 数据源清单 | 无 | `[{source, name, count}]` |
| `get_stats` | 全库统计 | 无 | `{total, companies, due30, campus, intern, fair}` |

### 4.1 `query_jobs` 参数明细

| 参数 | 取值 | 说明 |
|---|---|---|
| `city` | 如 `北京`、`上海`、`全国` | 精确匹配岗位城市 |
| `job_type` | `校招` / `实习` / `招聘会` | 内部映射 `campus` / `intern` / `fair` |
| `industry` | 如 `互联网`、`汽车` | 精确匹配行业 |
| `cohort` | 如 `2027届` | 届别 |
| `degree` | `不限` / `专科及以上` / `本科及以上` / `硕士及以上` | **层级制**：`本科及以上` 已包含硕士、博士，勿再传单层学历 |
| `keyword` | 关键词 | 模糊匹配岗位名 / 公司名 / 城市 |
| `sort` | `deadline`（默认）/ `newest` / `salary` | 截止最近 / 最新发布 / 薪资最高 |
| `page` | 从 1 开始 | 分页页码 |
| `page_size` | 默认 20，最大 50 | 每页条数 |

`jobs[]` 内每条字段：`id, title, company, city, industry, job_type, degree, cohort, salary_text, deadline_at, deadline_days, posted_at, source, source_url, apply_url`。

**约定**：`deadline_days >= 0` 表示未截止；`deadline_at` 为 `null` 表示招满即止 / 长期有效。

### 4.2 `get_stats` 返回字段

`total` 全库岗位数、`companies` 公司数、`due30` 近 30 天截止岗位数、`campus` / `intern` / `fair` 三类分布。

## 5. Agent 接入方式（用户侧）

用户侧统一走 `/agents` 分发页（前端路由），无需理解本仓库实现：

1. 打开站点 **`/agents`** 页面，复制对应 AI 产品的一键接入指令（按流行度排序：Codex → Claude → Kimi → DeepSeek Harness → Gemini → 豆包）。
2. 把指令粘贴给目标 Agent，Agent 会自行读取 `/agents/skill.md` 并按说明连接 MCP。
3. 手动配置场景使用页面提供的通用 `mcp.json` 模板（当前主流 Agent 均支持让用户粘贴 MCP 配置）。

`/agents/skill.md` 由 `apps/web/app/agents/skill.md/route.ts` 动态生成，其中的 MCP 地址来自 `apps/web/.env.local` 的 `MCP_URL`——**部署地址变化时只需改该环境变量，无需改代码**。

## 6. 部署与公网暴露

| 场景 | 做法 |
|---|---|
| 本地开发 / 小范围内测 | `cloudflared tunnel --url http://localhost:8001` 临时隧道，将生成的 `https://xxx.trycloudflare.com` 写入 `apps/web/.env.local` 的 `MCP_URL` 并重启 web |
| 长期稳定公网 | MCP Server 需**长驻进程**（不适合 Vercel 无服务器），建议部署到 Railway / Fly.io / 云服务器，用固定域名 + HTTPS；`MCP_URL` 指向该域名 |
| 隧道重启 | 临时隧道地址每次变化，重启后必须同步 `MCP_URL` 并重启 web 使 `/agents/skill.md` 更新 |

**注意**：MCP 地址变更后，已接入的 Agent 需要重新配置/重新发起接入指令，无法自动跟随。

## 7. 常见问题

| 问题 | 原因 / 解决 |
|---|---|
| 启动报 `未找到 DATABASE_URL` | `apps/worker/.env` 缺失或未配置 `DATABASE_URL`；本服务依赖该文件 |
| 工具调用报 `请求过于频繁` | 触发 60s / 120 次限流，稍等重试；公益服务请勿高频刷取 |
| `/agents/skill.md` 里的地址是 `localhost` | `apps/web/.env.local` 未配置 `MCP_URL` 或配置未生效，改后重启 `npm run dev/start` |
| Agent 连不上 MCP | 确认 8001 端口已启动、隧道/公网地址可达、HTTPS 证书有效（部分 Agent 拒绝明文 HTTP 之外的非常规地址） |
| 修改工具后测试 | 跑 `apps/mcp/full_test.py` 全量验证；改动返回字段需同步更新 `skill.md` 路由中的说明 |

## 8. 变更提示

- 新增 / 修改工具：同步更新 `server.py` docstring、`/agents/skill.md` 路由（`route.ts` 中的 SKILL 模板）、本文档第 4 节。
- 数据字段变化：检查 `_row_to_job()` 映射与前端 `lib/jobs.ts` 的类型保持一致。
