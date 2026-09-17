# Offer派 · OfferPai

> 不错过每一个 Offer · 陪你拿到第一个 Offer · 别慌，Offer 在路上

**Offer派** 是一个面向应届毕业生的公益校招 / 实习信息聚合平台。聚合高校就业网、国家 24365 平台与企业官网校招页的岗位信息，提供筛选检索、DDL 日历订阅、求职看板、轻量 AI 匹配与社区。**所有岗位跳转官方投递入口，不截留简历。**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.4-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase)](https://supabase.com)
[![Python](https://img.shields.io/badge/Python-3-3776AB?logo=python)](https://www.python.org)
[![License](https://img.shields.io/badge/License-TODO-999999)](#license)

---

## Demo / 截图

- 线上 Demo：**TODO**（当前通过临时 Cloudflare Tunnel 提供，请联系维护者获取最新地址，或本地运行）
- 界面截图：[`ui-check.png`](./ui-check.png) · Logo：[`logo.png`](./logo.png)

---

## 特性

- **岗位聚合** — 多数据源爬虫：高校就业网（福建理工大学、福州大学）、福建就业平台、国家 24365、企业官网校招页（蔚来 / 小米 / 小鹏，经飞书招聘）
- **筛选与搜索** — 关键词、招聘类型（校招 / 实习 / 招聘会 / 宣讲会）、城市、行业、届别、学历；支持按截止 / 最新 / 薪资排序
- **校招日历 + ICS 订阅** — `GET /api/calendar.ics` 提供 iCalendar 订阅，自动获得 DDL 提醒
- **求职看板** — 待投 / 已投 / 笔试 / 面试 / Offer 全流程管理（需登录，数据经 Supabase 多端同步）
- **轻量 AI 匹配** — 五维规则评分（MVP），简历本机处理、绝不上传
- **社区** — 薪资 / 面经 / 内推码分享，先审后发
- **Agent 接入（MCP）** — FastMCP 服务把岗位数据开放给任意 AI 助手（Codex / Claude / Kimi / DeepSeek Harness / Gemini / 豆包）
- **只跳官方入口** — 每条数据标注来源，跳转官方投递地址，不截留简历
- **合规爬取** — 遵守 `robots.txt`、数据源间限速、独立 UA，`content_hash` + `UNIQUE(source, external_id)` 去重

---

## 技术栈

| 层 | 技术 | 位置 |
|---|---|---|
| 前端 | Next.js 16（App Router）· React 19 · TypeScript · Tailwind CSS 4 | `apps/web/` |
| 数据库 / 认证 | Supabase Postgres（pgvector、RLS） | 云 `sqmgjxazzpcfjutzscyu` |
| 爬虫 / 数据管道 | Python · httpx · curl_cffi · Playwright · psycopg · APScheduler · FastAPI | `apps/worker/` |
| Agent 接入 | FastMCP（Streamable HTTP） | `apps/mcp/` |
| 数据缓存 | Next.js `unstable_cache`（60s ISR） | `apps/web/lib/jobs.ts` |
| 包管理 | pnpm workspace（`apps/*`） | 根目录 |

---

## 仓库结构

```
offer-hui/
├── apps/
│   ├── web/                  # Next.js 前端
│   │   ├── app/              # 12 个路由页面 + API（v1/jobs、calendar.ics、offerp/*）
│   │   ├── components/       # Nav / HomeClient / JobCard / BoardClient / ...
│   │   └── lib/              # jobs.ts（数据层）/ supabase.ts / ratelimit.ts
│   ├── worker/               # Python 爬虫与数据管道
│   │   ├── app/              # config / ingest / storage / models
│   │   ├── app/sources/      # 每个数据源一个文件（fjut, fjrclh, fj99, feishu, ncss, hit, pku, ...）
│   │   ├── cli.py            # CLI 入口（crawl / list / stats / scheduler）
│   │   └── scheduler.py      # 每日定时爬取
│   └── mcp/                  # FastMCP 服务（Agent 接入，端口 8001）
├── infra/supabase/migrations/ # SQL schema + RLS（202609040001_init.sql）
├── AGENTS.md                 # 面向 agent 的协作文档
├── start_all.bat             # 一键启动：MCP + Web + 隧道
└── check_urls.bat            # 打印当前公网隧道地址
```

---

## 安装

前置：Node.js 18+、pnpm、Python 3.10+（TODO：确认最低版本）。

### 前端

```bash
cd apps/web
npm install        # 或 pnpm install
```

### 爬虫 worker

```powershell
cd apps/worker
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### MCP 服务

复用 worker 的 venv 即可（依赖见 `apps/mcp/requirements.txt`：`fastmcp`、`psycopg`、`python-dotenv`）。

---

## 快速开始

### 1. 配置环境变量

按模板填写（密钥严禁提交）：

| 文件 | 变量 |
|---|---|
| `apps/web/.env.local` | `SUPABASE_URL`、`SUPABASE_SERVICE_KEY` |
| `apps/worker/.env` | `STORAGE_BACKEND`（postgres/sqlite）、`DATABASE_URL`、`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`USER_AGENT`、`REQUEST_DELAY`、`MAX_ITEMS_PER_SOURCE` |

worker 模板见 `apps/worker/.env.example`。

### 2. 初始化数据库

在 Supabase SQL 编辑器中执行迁移：

```
infra/supabase/migrations/202609040001_init.sql
```

### 3. 启动 Web

```bash
cd apps/web
npm run dev        # http://localhost:3000
```

### 4. 爬取数据（可选，worker）

```powershell
cd apps/worker
.\.venv\Scripts\python.exe cli.py crawl            # 全量抓取入库（自动去重）
.\.venv\Scripts\python.exe cli.py stats            # 库内统计
.\.venv\Scripts\python.exe cli.py list --limit 20  # 查看岗位
```

### 5. 启动 MCP 服务（可选，Agent 接入）

```powershell
cd apps/mcp
..\worker\.venv\Scripts\python.exe server.py --port 8001
```

### 6. 一键启动（Windows）

```bat
start_all.bat    # MCP :8001 + Web :3000（生产模式）+ 隧道
check_urls.bat   # 打印当前公网地址
```

---

## 配置

所有配置通过 `.env` 文件读取，密钥不进入代码。

| 配置项 | 默认值 | 用途 |
|---|---|---|
| `STORAGE_BACKEND` | `sqlite` | worker 存储后端：`postgres` / `sqlite` |
| `DB_PATH` | `data/offer.db` | 本地 SQLite 路径 |
| `DATABASE_URL` | — | Postgres 直连串（psycopg，pooler `:6543`） |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | — | Supabase 项目凭据 |
| `USER_AGENT` | Chrome UA | 爬虫 UA |
| `REQUEST_DELAY` | `1.2` | 请求间隔秒数（限速） |
| `MAX_ITEMS_PER_SOURCE` | `30` | 单源抓取上限 |

前端 API 限流：每 IP 60 次/分钟（`apps/web/lib/ratelimit.ts`）。MCP 限流：120 次/60 秒。

---

## 使用示例

### Web

- 首页 `/` 浏览与筛选岗位（关键词、类型、城市、行业、届别、学历；按截止/最新/薪资排序）
- `/calendar` 订阅 ICS 日历
- `/board` 求职看板（需登录）
- `/match` AI 匹配体验（本地规则引擎，含示例画像）
- `/agents` Agent 接入指南

### REST API

```bash
# 岗位列表（带筛选）
curl "http://localhost:3000/api/v1/jobs?job_type=campus&city=福州&sort=deadline&page=1&page_size=20"

# 岗位详情
curl "http://localhost:3000/api/v1/jobs/<id>"

# 数据源与数量
curl "http://localhost:3000/api/v1/sources"

# 统计
curl "http://localhost:3000/api/v1/stats"

# 日历订阅源
curl "http://localhost:3000/api/calendar.ics"
```

### Worker FastAPI（端口 8123）

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8123
```

- `GET /healthz` — 健康检查（含岗位数）
- `POST /crawl?dry_run=false` — 触发抓取
- `GET /jobs?limit=50&status=published&source=hit` — 查询岗位

### MCP 工具（Agent 接入）

| 工具 | 作用 | 关键参数 |
|---|---|---|
| `query_jobs` | 岗位列表 + 筛选 + 排序 + 分页 | `city` / `cohort` / `degree` / `job_type` / `keyword` |
| `get_job_detail` | 单个岗位详情 | `job_id` |
| `get_sources` | 数据源清单 + 数量 | — |
| `get_stats` | 全库统计 | — |

在 MCP 客户端 `mcp.json` 中添加：

```json
{
  "mcpServers": {
    "offerp": { "type": "http", "url": "http://localhost:8001" }
  }
}
```

---

## API 参考

### `GET /api/v1/jobs`

| 参数 | 类型 | 说明 |
|---|---|---|
| `q` | string | 关键词搜索 |
| `job_type` | string | 校招 / 实习 / 招聘会 / 宣讲会 |
| `city` | string | 城市筛选 |
| `industry` | string | 行业筛选 |
| `cohort` | string | 届别（如 2027届） |
| `degree` | string | 不限 / 专科及以上 / 本科及以上 / 硕士及以上 |
| `sort` | string | `deadline` / `newest` / `salary` |
| `page` | int | 从 1 开始（默认 1） |
| `page_size` | int | 1–50（默认 20） |

响应：`{ code, data: { items: JobView[], total, page, page_size } }`（TODO：确认实际返回结构）。

### `GET /api/calendar.ics`

返回岗位截止日期的 iCalendar 订阅源。

### 数据库核心表

`companies`、`jobs`（含 `content_hash`、`embedding vector(1536)`）、`profiles`、`subscriptions`、`saved_jobs`、`applications`、`resumes`、`posts`、`post_likes`、`crawl_sources`、`crawl_runs` — RLS：岗位/公司公开可读，用户私有表仅本人可见。

---

## 架构

```
爬虫 (apps/worker, Python)
   │  httpx / curl_cffi / Playwright
   ▼
Supabase Postgres  ── content_hash 去重, UNIQUE(source, external_id)
   │
   ├──► Next.js unstable_cache (60s) ──► REST /api/v1/* ──► 前端组件
   │
   └──► MCP Server (apps/mcp, :8001) ──► AI Agents (query_jobs / get_job_detail / ...)
```

数据流：**抓取 → 解析 → 去重入库 → 提供（Web REST / MCP）→ 前端渲染**。

定时爬取：`python cli.py scheduler`（APScheduler，默认每日 02:00；`--now` 立即执行一次）。

---

## FAQ

**数据从哪来？**
高校就业网（福建理工大学、福州大学）、福建就业平台（fj99）、国家 24365（NCSS）、企业官网校招页（蔚来 / 小米 / 小鹏，经飞书招聘）。每条记录都带来源与官方投递地址。

**AI 匹配真的调用大模型吗？**
目前没有。MVP 采用五维规则引擎（届别 / 学历 / 行业 / 城市 / 岗位关键词），纯本地运行，简历绝不上传。路线图是：规则 → spaCy NER → LLM 兜底的解析，pgvector 向量检索，以及 LLM 只对 top-10 生成匹配理由。`jobs.embedding` 字段已在 schema 中预留。

**会截留简历吗？**
不会。所有岗位跳转官方投递入口。本项目为公益性质、不盈利。

**不登录能订阅 DDL 提醒吗？**
可以。使用 ICS 订阅源（`/api/calendar.ics`）导入手机日历即可。

**为什么有些数据缺失或过期？**
爬虫仍在完善中，数据源接口可能变动。欢迎通过 Issues 反馈。

**Windows 特有问题？**
`globals.css` 必须用带 BOM 的 UTF-8 保存，否则 `npm run build` 失败。飞书招聘页只能通过 Playwright 拦截 API 抓取（httpx/curl_cffi 会被 405/400 拒绝）。

---

## 贡献

1. Fork 本仓库并创建功能分支。
2. 新增数据源：参照 `base.py`（BaseSource 自带 UA / 限速 / Referer）在 `apps/worker/app/sources/` 新建 `<name>.py`，在 `ingest.py` 的 `get_sources()` 注册，用 `cli.py crawl --dry` 验证。
3. 前端改动：页面在 `apps/web/app/`，组件在 `apps/web/components/`，数据层在 `apps/web/lib/jobs.ts`。
4. 交付前运行 `npm run build`（必须零错误）与 `python cli.py stats` 验证数据条数。
5. 发起 Pull Request。Commit 信息格式：`[YYYY-MM-DD HH:mm] type: 描述`。

TODO：贡献指南 / CODE_OF_CONDUCT。

---

## License

**TODO** — 仓库暂无 LICENSE 文件，请与维护者确认后补充（项目公益非营利，MIT 为候选）。

---

## 项目状态

- ✅ 可用：岗位聚合（筛选/排序/分页）、日历 + ICS、求职看板（多端同步）、AI 匹配页、社区页、收藏、品牌与打字机 slogan、首页动态背景、本地 git 备份、MCP Agent 接入
- 🚧 开发中：背景交互调优、数据源扩充、AI 匹配正式版（pgvector + LLM）
- 📋 规划中：邮件提醒（SendGrid/Resend）、Web Push、部署上线（Vercel + Railway 已调研）
