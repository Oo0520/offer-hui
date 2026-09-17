# 参与贡献指南

首先感谢你对 **Offer派（OfferPai）** 的关注！这是一个面向应届毕业生的公益校招/实习信息聚合平台，欢迎任何形式的贡献——不止是代码，还包括数据源、文档、测试、Bug 反馈与产品建议。

## 目录

- [项目速览](#项目速览)
- [如何贡献](#如何贡献)
- [开发环境](#开发环境)
- [代码库结构](#代码库结构)
- [新增一个数据源](#新增一个数据源)
- [前端改动](#前端改动)
- [数据库改动](#数据库改动)
- [提交规范](#提交规范)
- [合规红线](#合规红线)
- [测试与验证](#测试与验证)
- [提交流程](#提交流程)

## 项目速览

| 层 | 技术 | 位置 |
|---|---|---|
| 前端 | Next.js 16（App Router）· React 19 · TypeScript · Tailwind CSS 4 | `apps/web/` |
| 数据库 / 认证 | Supabase Postgres（pgvector、RLS） | 云端 |
| 爬虫 / 数据管道 | Python · httpx · curl_cffi · Playwright · psycopg · APScheduler · FastAPI | `apps/worker/` |
| Agent 接入 | FastMCP（Streamable HTTP） | `apps/mcp/` |
| 包管理 | pnpm workspace（`apps/*`） | 根目录 |

完整说明见 [README.zh-CN.md](./README.zh-CN.md)。

## 如何贡献

- **报告 Bug**：使用 [Bug 模板](../../issues/new?template=bug_report.yml)，尽量附上复现步骤、浏览器/设备环境与截图。
- **提功能建议**：使用 [功能请求模板](../../issues/new?template=feature_request.yml)。
- **新增数据源**：按下方「新增一个数据源」操作，这是当前最需要的贡献。
- **内容校对**：发现岗位信息标注错误、来源缺失、跳转失效，直接提交 Issue 或 PR。
- **文档**：README、本指南、AGENTS.md 的任何改进都欢迎。

> 本项目为公益性质、不盈利，所有数据必须**标注来源并跳转官方投递入口，不截留简历**。

## 开发环境

前置：Node.js 18+、pnpm、Python 3.10+。

```bash
# 前端依赖
cd apps/web && npm install

# worker 依赖（Windows）
cd apps/worker
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

配置环境变量（不提交真实密钥）：

| 文件 | 变量 |
|---|---|
| `apps/web/.env.local` | `SUPABASE_URL`、`SUPABASE_SERVICE_KEY` |
| `apps/worker/.env` | `STORAGE_BACKEND`、`DATABASE_URL`、`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`USER_AGENT`、`REQUEST_DELAY`、`MAX_ITEMS_PER_SOURCE` |

模板见 `apps/worker/.env.example`。

## 代码库结构

```
offer-hui/
├── apps/
│   ├── web/                    # Next.js 前端
│   │   ├── app/                # 页面路由 + API 路由（v1/jobs、calendar.ics、offerp/*）
│   │   ├── components/         # Nav / HomeClient / JobCard / BoardClient / ...
│   │   └── lib/                # jobs.ts（数据层）/ supabase.ts / ratelimit.ts
│   ├── worker/                 # Python 爬虫与数据管道
│   │   ├── app/                # config / ingest / storage / models
│   │   ├── app/sources/        # 每个数据源一个文件
│   │   ├── cli.py              # crawl / list / stats / scheduler
│   │   └── scheduler.py        # 每日定时爬取
│   └── mcp/                    # FastMCP 服务（Agent 接入，:8001）
├── infra/supabase/migrations/  # SQL 迁移（每个文件一个变更）
├── AGENTS.md                   # 面向 agent 的协作文档
└── start_all.bat               # 一键启动：MCP + Web + 隧道
```

## 新增一个数据源

这是当前最欢迎的贡献类型。步骤：

1. 在 `apps/worker/app/sources/` 新建 `<name>.py`，继承 `base.py` 中的 `BaseSource`（自带 UA、限速、Referer 处理）。
2. 实现抓取逻辑：
   - 优先找官方 API / RSS / JSON 接口，避免解析 HTML；
   - 动态页面优先用 Playwright 拦截 XHR 接口（参考 `feishu` 源），避免暴力渲染；
   - 遵守目标站点 `robots.txt`，请求间隔不低于 `REQUEST_DELAY`（默认 1.2s）。
3. 解析结果映射到统一字段：`title / company / city / industry / job_type / degree / cohort / deadline_at / posted_at / apply_url / source_url / external_id / content`。
4. 在 `ingest.py` 的 `get_sources()` 中注册。
5. 本地验证：

```powershell
cd apps/worker
.\.venv\Scripts\python.exe cli.py crawl --dry      # 试跑不落库
.\.venv\Scripts\python.exe cli.py stats            # 确认入库统计
```

6. 确认去重生效：`content_hash` + `UNIQUE(source, external_id)` 保证同一岗位不会重复入库。

## 前端改动

- 页面在 `apps/web/app/`，组件在 `apps/web/components/`，数据层在 `apps/web/lib/jobs.ts`。
- 移动端优先（本产品是网站，不是 App），桌面端断点 992px。
- 设计风格遵循现有 Sophisticated Playful 风格：Charcoal `#171e19`、Vibrant Red `#ca0013`、Gray-Green `#b7c6c2`、Off-White `#eeebe3`；主卡圆角 40px、嵌套元素 24px；字体 Nunito + Noto Sans SC。
- **Windows 注意**：`globals.css` 必须保存为 **UTF-8 with BOM**，否则 `next build` 会失败。

## 数据库改动

- 在 `infra/supabase/migrations/` 新增迁移文件（命名 `YYYYMMDD000000_描述.sql`），**不要修改已应用的迁移**。
- 遵循既有 RLS 约定：岗位/公司公开可读，用户私有表（saved_jobs、applications 等）仅 `auth.uid()` 本人可见。
- 涉及向量检索（AI 匹配）时，`jobs.embedding` / `resumes.embedding` 使用 `vector(1536)`。

## 提交规范

Commit 信息必须带时间戳，便于按时间轴回溯：

```
[YYYY-MM-DD HH:mm] type: 描述
```

示例：

```
[2026-09-17 21:00] feat: 新增 XX 高校就业网数据源
[2026-09-17 21:05] fix: 修复日历订阅 URL 失效
[2026-09-17 21:10] docs: 更新数据源文档
```

`type` 参考：`feat` / `fix` / `docs` / `refactor` / `perf` / `test` / `chore` / `style`。

## 合规红线

- 遵守目标站点 `robots.txt`，设置合理请求频率与独立 UA。
- 只采集**公开的岗位信息**，不碰 BOSS直聘 / 智联等反爬严格的商业平台。
- 不收集、不存储任何人的简历与个人隐私数据。
- 所有数据必须**标注来源**，投递必须**跳转官方入口**，不截留简历。
- 多数高校就业网在公网不可达（教育网限制），抓取前先确认可达性。

## 测试与验证

交付前必须完成：

```powershell
# 前端构建必须零错误
cd apps/web && npm run build

# worker 单元测试
cd apps/worker
.\.venv\Scripts\python.exe -m unittest discover tests

# 数据条数验证
.\.venv\Scripts\python.exe cli.py stats
```

前端 lint：`npm run lint`。

## 提交流程

1. Fork 本仓库并创建功能分支（`feat/xxx`、`fix/xxx`、`docs/xxx`）。
2. 完成开发，本地通过「测试与验证」。
3. 提交 PR，使用 [PR 模板](./.github/PULL_REQUEST_TEMPLATE.md)，关联相关 Issue。
4. 维护者 review 后合并。有任何问题可以在 [QQ 群](https://qm.qq.com/q/cm28dcceEU) 交流。
