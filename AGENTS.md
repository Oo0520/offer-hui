# AGENTS.md — Offer派 项目协作文档

> 本文件供后续 agent 快速接手本项目使用。阅读顺序：架构 → 快速开始 → 后端数据 → 前端修改 → 陷阱 → 协作约定。
> 最后更新：2026-09-27（日历订阅 URL 修复、/api/revalidate 按需失效缓存、安卓日历订阅实测自动同步）

## 1. 项目架构速览

**定位**：应届生求职信息聚合平台（MVP，公益性质）。聚合高校就业网 / 企业官网校招信息，提供筛选浏览、DDL 日历订阅、求职看板（5 列拖拽）、收藏、轻量 AI 匹配。**不截留简历，所有岗位跳转官方投递入口。**

**技术栈**：

| 层 | 技术 | 位置 |
|---|---|---|
| 前端 | Next.js 16（App Router, React 19）+ Tailwind v4 | `apps/web/` |
| 数据库 / Auth | Supabase（Postgres + Auth + pgvector） | 云端 project `sqmgjxazzpcfjutzscyu` |
| 爬虫 | Python（Scrapling / curl_cffi / httpx） | `apps/worker/` |
| MCP | Python MCP server | `apps/mcp/` |
| 部署 | **Vercel**（GitHub main 自动部署） | https://offerpai.vercel.app/ |
| 正式域名 | **https://www.offerpiai.cn**（apex 自动 308 跳 www，DNS 在腾讯云 DNSPod） | — |

**目录结构**：

```
offer-hui/
├── apps/
│   ├── web/                 # Next.js 前端
│   │   ├── app/             # about/agents/board/calendar/community/favorites/login/match/offerp/profile + api/
│   │   ├── components/       # Nav/HomeClient/BoardClient/JobCard/...
│   │   └── lib/             # jobs.ts（数据层）/supabase.ts（浏览器端 auth）/ratelimit.ts
│   ├── worker/              # Python 爬虫依赖 + 历史脚本
│   │   ├── requirements.txt # scrapling[fetchers] / curl_cffi / patchright
│   │   └── cli.py / clean_data.py / migrate.py
│   └── mcp/                 # MCP server.py（给 Agent 调用）
├── .github/workflows/
│   └── ci.yml               # web build + worker test（push main / PR 触发）
├── infra/supabase/migrations/  # SQL 迁移
└── design-doc/

# 注意：实际每日跑的爬虫脚本在仓库外：
#   E:\AIMemory\DaoBao\crawl-fjut.py
#   E:\AIMemory\DaoBao\crawl-fjrclh.py
```

**数据流**：

```
豆包定时任务（每天 02:00 北京，跑在本地 Windows）
  → python crawl-fjut.py + crawl-fjrclh.py 增量抓
  → upsert content_hash 去重 → Supabase jobs 表
  → 调用 GET /api/revalidate?secret=<ADMIN_TOKEN> → 立即失效 jobs 缓存（无需重新 build）
                                                                  ↓
用户访问（/ /calendar /match /favorites /board 为 force-static，ISR 按需重新生成）
  → fetchAllJobs() 全量拉取最新数据
用户登录态操作（收藏/看板）→ 浏览器端 supabase-js anon key → RLS → user_jobs 表
```

## 2. 快速开始

### 环境变量

| 文件 | 变量 | 用途 |
|---|---|---|
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` | 浏览器端 Supabase（auth + user_jobs） |
| 同上 | `SUPABASE_URL`、`SUPABASE_SERVICE_KEY` | 服务端 jobs.ts 全量拉取（**无 NEXT_PUBLIC_ 前缀，不能暴露浏览器**） |
| 同上 | `ADMIN_TOKEN` | /api/offerp/* 手动录入后台 + `/api/revalidate` 数据刷新鉴权 |
| `apps/worker/.env` | `DATABASE_URL`、`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`USER_AGENT`、`REQUEST_DELAY` | 爬虫入库 |

**Vercel 部署时必须在 Project Settings → Environment Variables 配齐 4 个 Supabase 环境变量**（两个 URL + 两个 KEY），否则 build 报 `supabaseUrl is required`。Secrets 已配：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`。

> ⚠️ EdgeOne 已删除（未备案 .cn 域名国内手机打不开，2026-09-24 迁到 Vercel）。不要再提 EdgeOne。

### 常用命令

```powershell
# 前端
cd apps/web
npm run dev        # 开发（3000）
npm run build      # 生产构建（必须零错误）
npm start

# 爬虫（本地手动跑一次调试；线上由豆包定时任务每天 12:00 自动跑）
# 脚本在仓库外：
cd E:\AIMemory\DaoBao
offer-hui\apps\worker\.venv\Scripts\python.exe crawl-fjut.py
offer-hui\apps\worker\.venv\Scripts\python.exe crawl-fjrclh.py

# git（本地备份，时间戳格式）
git add -A
git commit -m "[2026-09-24 21:30] feat: 描述"
# 不主动 push，用户说"上传"才 push 到 https://github.com/Oo0520/offer-hui
# push main 后 Vercel 自动部署，GitHub Actions 跑 CI（web build + worker test）
```

## 3. 后端与数据

### 3.1 Supabase 表结构

| 表 | 用途 | 关键字段 |
|---|---|---|
| `companies` | 公司 | name(unique), industry |
| `jobs` | 岗位（核心） | source, source_url(unique), external_id, title, city, province, industry, job_type(campus/intern/fair/teachin/announcement), degree, cohort, salary_min/max/text, deadline_at, posted_at, apply_url, status(published/expired), tags(jsonb), content_hash, embedding vector(1536) |
| `user_jobs` | **用户收藏+看板合一表**（实际线上表） | user_id, job_id, status(star/pending/applied/written/interview/offer)，主键 (user_id, job_id, status) |
| `profiles` | 用户扩展 | id, username, university, major, cohort |
| `subscriptions` | 日历订阅 | filters, ics_token |
| `posts` / `post_likes` | 社区（先审后发） | status(pending/approved) |
| `resumes` | 简历（未启用） | embedding |
| `crawl_sources` / `crawl_runs` | 爬虫监控 | last_run_at, items_new |

> ⚠️ **迁移文件不一致**：`infra/supabase/migrations/202609040001_init.sql` 里写的是 `applications` + `saved_jobs` 两张表，但线上实际用的是 `user_jobs` 单表（status 字段区分收藏和看板阶段）。新环境部署时要手动补一条 `create table user_jobs ...` 迁移，否则前端登录后操作全挂。

**去重键**：`UNIQUE(source, external_id)` + `content_hash` 变化触发 UPDATE。

**RLS**：jobs/companies 公开读（`status='published'`）；user_jobs/profiles 等用户表仅本人可见（`auth.uid() = user_id`）。

### 3.2 爬虫数据源

| source 键 | 数据源 | 抓取方式 | 文件 |
|---|---|---|---|
| `fjut` | 福建理工大学就业网 | Scrapling StealthyFetcher，5 板块（全职/实习/宣讲会/招聘会/招聘公告） | `E:\AIMemory\DaoBao\crawl-fjut.py`（在豆包定时任务里跑） |
| `fjrclh` | 福州大学就业网 | httpx API + 增量 | `E:\AIMemory\DaoBao\crawl-fjrclh.py` |
| `fj99` | 福建就业网 | POST + md5 签名 | `run_fj99.py` |
| `campus2027` / `open_jobs` / `wechat` | 开源社区 / 公众号 | 历史导入 | `import_*.py` |

**新数据源接入**：写独立脚本 → upsert 到 jobs 表 → 在豆包定时任务里加一步（任务标题「Offer派每日数据抓取刷新」，cron `0 2 * * *` Asia/Shanghai，跑在本地 Windows）。爬虫跑完后调用 `GET https://www.offerpiai.cn/api/revalidate?secret=<ADMIN_TOKEN>` 立即失效缓存（无需 git push / 重新 build）。

### 3.3 数据层（lib/jobs.ts）

- `fetchAllJobs()`：`unstable_cache` 包装，**revalidate: false**（build 时静态打包，不自动重新验证）
- 全量分页拉 jobs（每页 1000 循环），只拉展示字段（不拉 description/tags/embedding）
- **筛选/排序/分页全在浏览器端 JS 做**（filterJobs / sortJobsBy / dimOptions）
- 学历层级：不限=0/专科=1/本科=2/硕士=3/博士=4，筛选用"本科及以上"这种层级选项
- 已静态化路由：`/`、`/calendar`、`/match`、`/favorites`、`/board`（都是 force-static）
- API 路由 `/api/v1/jobs` 是 force-dynamic 的（给 MCP / 外部调用），有内存限流 60 次/分/IP

## 4. 前端修改指南

### 4.1 路由

| 路由 | 页面 |
|---|---|
| `/` | 首页：hero + 筛选 + 岗位列表 |
| `/calendar` | 校招日历 + ICS 订阅 |
| `/board` | 求职看板（5 列拖拽，拖出看板移除） |
| `/match` | AI 匹配（轻量） |
| `/community` | 社区 |
| `/favorites` | 收藏 |
| `/profile` | 我的 |
| `/login` | 邮箱密码登录/注册（Supabase Auth） |
| `/about` | 关于（含 QQ 群二维码） |
| `/agents` | Agent / MCP 接入说明 |
| `/offerp` | 手动录入后台（ADMIN_TOKEN 鉴权） |

### 4.2 关键文件

| 文件 | 职责 |
|---|---|
| `app/layout.tsx` | 全局布局：Nav + HeroBackground + footer |
| `components/Nav.tsx` | 导航栏 + 打字机 slogan + 登录头像下拉 |
| `components/HomeClient.tsx` | 首页筛选/排序/分页/收藏/加入待投 |
| `components/BoardClient.tsx` | 看板 5 列拖拽 + 拖出移除 + toast + 引导 |
| `components/JobCard.tsx` | 岗位卡片 |
| `components/HeroBackground.tsx` | 首页动态背景（粒子 logo/液体光斑/网格/光晕，仅桌面 ≥992px） |
| `lib/jobs.ts` | 数据层核心 |
| `lib/supabase.ts` | 浏览器端 supabase 客户端（anon key + auth persistSession） |

### 4.3 用户数据同步逻辑（重要）

所有用户交互（收藏 star / 看板 pending/applied/written/interview/offer）双写：
1. 先写 localStorage（`offer_fav` 数组 / `offer_board` 对象）
2. 如果已登录，upsert 到 `user_jobs` 表（onConflict: user_id,job_id,status）
3. 登录时把 localStorage 里有但数据库没有的记录补传上去（existingMap 去重）
4. onAuthStateChange 时重新从 user_jobs 拉全量覆盖本地 state

**设计意图**：未登录时离线可用，登录后跨设备同步。

## 5. 已知陷阱（踩过的坑，别再踩）

1. **globals.css 必须 UTF-8 无 BOM**，否则 build 失败。
2. **Vercel Node runtime 支持 unstable_cache**：岗位数据走 build 时静态打包（revalidate: false）。**不要加 force-dynamic 到静态页**。数据更新靠豆包定时任务每天 02:00 跑爬虫 upsert 到 Supabase，然后**调用 `/api/revalidate?secret=<ADMIN_TOKEN>` 按需失效缓存**（接口内部 `revalidateTag("jobs", {expire:0})` + `revalidatePath` 各静态页），300ms 内全球生效，无需重新 build。
3. **SERVICE_KEY 绝不能加 NEXT_PUBLIC_ 前缀**，否则暴露浏览器。
4. **爬虫跑在豆包本地定时任务**：任务名「Offer派每日数据抓取刷新」，cron `0 2 * * *` Asia/Shanghai，跑在本地 Windows。依赖电脑开机且豆包在线。脚本路径在 `E:\AIMemory\DaoBao\crawl-fjut.py` 和 `crawl-fjrclh.py`（不在仓库 `apps/worker/` 里，是仓库外的独立脚本）。跑完调用 `/api/revalidate` 失效缓存（不再 push 空 commit 触发 redeploy）。
5. **PowerShell 中文编码**：读含中文的 .py/.md 文件用 `[System.IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)`，不要用 Get-Content 管道（默认 ANSI 会乱码）。
6. **git commit 格式**：`[YYYY-MM-DD HH:mm] type: 描述`，方便时间轴回溯。
7. **端口占用**：改完代码重启前先杀 3000 端口旧进程（`Get-NetTCPConnection :3000 | Stop-Process`），否则旧进程占着端口跑老代码。
8. **Vercel 环境变量**：4 个 Supabase 变量必须配全，少一个 build 就挂。CI 里用 placeholder URL（`https://placeholder.supabase.co`）做 build 降级，见 `apps/web/lib/jobs.ts` 里 `_fetchAllJobsRaw` 的 try/catch。
9. **user_jobs 表 RLS**：新环境建表后必须加 `using (auth.uid() = user_id)` 的 RLS 策略，否则 anon key 能读全表。
10. **PR 流程**：不直接 push main，走分支 + PR；用户说"合并"才合。

## 6. 设计资产

| 项 | 值 |
|---|---|
| 主色 | Charcoal `#171e19`（背景） |
| 强调色 | Vibrant Red `#ca0013`（CTA/品牌） |
| 辅助色 | Gray-Green `#b7c6c2`（边框/次要）、Off-White `#eeebe3`（正文） |
| 字体 | Nunito（标题）+ Noto Sans SC（正文） |
| 圆角 | 主卡 40px / 嵌套 24px |
| 断点 | 992px（动态背景只 ≥992px） |
| Logo | `apps/web/public/logo.png` |

## 7. 当前进度状态（2026-09-24）

**✅ 已上线**：
- 岗位聚合（筛选/排序/分页/搜索/城市/行业/学历/学校筛选）
- 求职看板 5 列（待投/已投/笔试/面试/Offer），拖拽换阶段，拖出看板移除，toast 反馈，首次引导
- 收藏（♥ 切换，toast）
- Supabase Auth 邮箱注册登录，跨设备同步收藏+看板
- 校招日历 + ICS 订阅（订阅 URL 用固定 https，iPhone/安卓 URL 订阅均实测**自动同步**，含增删）
- 打字机 slogan（Offer派·不错过每一个Offer / 陪你拿到第一个Offer / 别慌，Offer在路上）
- 首页动态背景（粒子 logo + 液体光斑 + 网格 + 鼠标光晕，仅桌面端）
- MCP server（Agent 接入 /agents 页）
- 手动录入后台 /offerp（ADMIN_TOKEN）
- **Vercel CI/CD**（push main 自动部署，正式域名 https://www.offerpiai.cn）
- **豆包定时任务爬虫**（每天 02:00 北京自动跑增量 + `/api/revalidate` 失效缓存）
- **`/api/revalidate` 按需失效缓存**（修复「爬虫已入库但网站不更新」：unstable_cache 跨部署持久，需主动失效）

**🔄 待完善**：
- 爬虫依赖本地 Windows 开机 + 豆包在线；电脑关机/豆包没开就不跑
- GitHub Actions 里的 `crawl.yml` 是历史残留，实际不用（境外 runner 访问 fjut.jysd.com 超时）

**📋 规划中**：
- 邮件提醒 / Web Push
- AI 匹配真实 embedding 向量检索
- 社区内容运营

## 8. 协作约定

1. **git**：本地 commit 带时间戳，不主动 push；用户说"上传/发 PR"才 push，且**走分支 + PR，不直接合并 main**。
2. **流程**：新功能先给方案让用户确认再动手。
3. **交付**：前端改完 `npm run build` 零错误；改完 Git 提交到分支 PR 并把 Vercel 部署临时地址发给用户。
4. **设计红线**：深色 Sophisticated Playful 风格。
5. **沟通**：中文，极简无废话。
