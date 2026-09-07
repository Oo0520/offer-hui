# AGENTS.md — Offer派 项目协作文档

> 本文件供后续 agent 快速接手本项目使用。阅读顺序：架构 → 快速开始 → 后端数据 → 前端修改 → 陷阱 → 协作约定。

## 1. 项目架构速览

**定位**：应届生求职信息聚合平台（MVP）。聚合高校就业网 / 24365 / 企业官网校招信息，提供筛选浏览、DDL 日历订阅、求职看板、轻量 AI 匹配、社区。**不截留简历，所有岗位跳转官方投递入口。**

**技术栈**：

| 层 | 技术 | 位置 |
|---|---|---|
| 前端 | Next.js（App Router）+ Tailwind 风格 CSS | `apps/web/` |
| 数据库 | Supabase Postgres（含 pgvector） | 云端 `sqmgjxazzpcfjutzscyu` |
| 爬虫 | Python（httpx / curl_cffi / Playwright） | `apps/worker/` |
| 缓存 | Next.js `unstable_cache` ISR（60s） | `apps/web/lib/jobs.ts` |

**目录结构**：

```
offer-hui/
├── apps/
│   ├── web/                 # Next.js 前端
│   │   ├── app/             # 7 个路由页面 + API Routes
│   │   ├── components/      # 页面组件（Nav/JobCard/HomeClient...）
│   │   └── lib/             # 数据层（jobs.ts / supabase.ts）
│   └── worker/              # Python 爬虫
│       ├── app/
│       │   ├── sources/     # 每个数据源一个文件
│       │   ├── ingest.py    # 数据管道主流程
│       │   ├── storage.py   # PostgresStorage 存储层
│       │   └── models.py    # Job 模型 + content_hash
│       └── cli.py           # 命令行入口
├── infra/supabase/migrations/  # SQL 迁移（表结构 + RLS）
├── design-doc/              # 早期 UI 设计稿
└── cloudflared.exe          # 内网穿透
```

**数据流**：

```
爬虫(worker) → content_hash 去重 → Supabase jobs 表
                                          ↓
Next.js unstable_cache(60s) ← Supabase REST ← 前端组件渲染
```

## 2. 快速开始

### 环境变量（.env 文件，无明文提交）

| 文件 | 变量 | 用途 |
|---|---|---|
| `apps/worker/.env` | `STORAGE_BACKEND`（postgres）、`DATABASE_URL`（Postgres 直连串）、`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`USER_AGENT`、`REQUEST_DELAY`、`MAX_ITEMS_PER_SOURCE` | 爬虫入库 |
| `apps/web/.env.local` | `SUPABASE_URL`、`SUPABASE_SERVICE_KEY` | 前端读数据（服务端） |

凭据只存在于上述 .env 文件，**不要写入代码或提交 git**。

### 常用命令

```bash
# 前端
cd apps/web
npm run dev        # 开发模式（3000端口）
npm run build      # 生产构建（必须零错误才能交付）
npm start          # 生产模式运行

# 爬虫（Windows PowerShell）
cd apps/worker
python cli.py crawl          # 全量抓取入库
python cli.py crawl --dry    # 只抓不写库（统计）
python cli.py stats          # 库内统计
python cli.py list           # 查看岗位列表

# 内网穿透（临时隧道）
cd offer-hui
.\cloudflared.exe tunnel --url http://localhost:3000
```

## 3. 后端与数据

### 3.1 Supabase 核心表（`infra/supabase/migrations/202609040001_init.sql`）

| 表 | 用途 | 关键字段 |
|---|---|---|
| `companies` | 公司 | name(unique), industry |
| `jobs` | 岗位（核心） | source, source_url, external_id, title, company_id, city, industry, job_type(campus/intern/fair), degree, cohort, salary_min/max/text, deadline_at, apply_url, status, content_hash, embedding |
| `applications` | 求职看板 | user_id, job_id, stage(applied/written/interview/offer/removed) |
| `saved_jobs` | 收藏 | user_id, job_id |
| `subscriptions` | 提醒订阅 | filters, ics_token, push_sub |
| `posts` | 社区帖子 | status(pending/approved/rejected) 先审后发 |
| `resumes` | 简历 | embedding vector(1536) |

**去重键**：`UNIQUE(source, external_id)` + `content_hash`（内容变化检测，新 hash 触发 UPDATE）。

**RLS**：jobs/companies 公开读；用户私有表仅本人可见（`auth.uid()`）。

### 3.2 爬虫数据源（`apps/worker/app/sources/`）

| 源 | 数据源 | 抓取方式 | 库内条数 | 文件 |
|---|---|---|---|---|
| `fjut` | 福建理工大学就业网 | curl_cffi impersonate chrome，首页+详情页 HTML | 14 | `fjut.py` |
| `fjrclh` | 福建人才联合网 | POST `/CmsInterface/getCmsList`（typeid=1, typedir=zwxx/xjh/zph） | 139 | `fjrclh.py` |
| `fj99` | 福建就业网 | POST `/bys/.../queryPost`，**md5 签名** `sign=md5(json(body)+"&queryPost")` | 200 | `fj99.py` |
| `feishu_nio/mi/xiaopeng` | 蔚来/小米/小鹏官网 | **Playwright 拦截 API**（httpx/curl_cffi 被反爬 405/400） | 200×3 | `feishu.py` |
| `ncss` | 国家 24365 平台 | （历史源，不在 ingest 主流程） | 47 | `ncss.py` |

**注意**：`ingest.py` 的 `get_sources()` 当前只跑 6 个源（fjut/fjrclh/fj99 + 3 飞书），ncss 数据已在库但不在主流程。

**新数据源接入步骤**：
1. 在 `sources/` 新建 `xxx.py`，继承 `BaseSource`（自带 UA/限速/Referer），实现 `fetch() -> list[Job]`
2. 在 `ingest.py` 的 `get_sources()` 注册
3. `python cli.py crawl --dry` 试抓 → `python cli.py crawl` 入库

**合规约束**：遵守 robots.txt、`REQUEST_DELAY` 限速、独立 UA、数据标注来源 + 官方跳转。

## 4. 前端修改指南

### 4.1 路由一览

| 路由 | 页面 | 状态 |
|---|---|---|
| `/` | 首页：hero + 筛选 + 岗位列表 + 分页 | ✅ 可用 |
| `/calendar` | 校招日历 + ICS 订阅 | ✅ 可用 |
| `/board` | 求职看板（待投/已投/笔试/面试/Offer） | ✅ 可用 |
| `/match` | AI 匹配 | ✅ 页面可用 |
| `/community` | 社区（悬赏 + 身份标签） | ✅ 页面可用 |
| `/favorites` | 收藏 | ✅ 可用 |
| `/profile` | 我的 | ✅ 可用 |

### 4.2 关键文件

| 文件 | 职责 |
|---|---|
| `app/layout.tsx` | 全局布局：Nav + HeroBackground + footer |
| `components/Nav.tsx` | 导航栏（含打字机口号 Typewriter 组件） |
| `components/HomeClient.tsx` | 首页逻辑（筛选/排序/分页/加入待投） |
| `components/JobCard.tsx` | 岗位卡片 |
| `components/HeroBackground.tsx` | 首页动态背景（粒子 Logo/液体光斑/网格/光晕，仅桌面端≥992px） |
| `lib/jobs.ts` | **数据层核心**：类型、字段映射、筛选、排序、学历层级 |
| `lib/supabase.ts` | Supabase 客户端 |
| `app/api/calendar.ics/route.ts` | ICS 日历订阅接口 |

### 4.3 数据层说明（lib/jobs.ts）

- `fetchAllJobs()`：`unstable_cache` 包装，60s 共享缓存，所有页面共用一次 Supabase 请求，**避免每页全量拉取**
- `JobView`：前端展示字段（含 `deadlineDays` 距今天数、`lg/bg` 徽标）
- `filterJobs()`：支持 q(搜索)/jobType/city/industry/cohort/degree
- **学历筛选是层级制**：`degreeLevel()` 映射 不限=0/专科=1/本科=2/硕士=3/博士=4，选项只有「不限/专科及以上/本科及以上/硕士及以上」（**不要**再单独加"本科"等重复项）
- `sortJobsBy()`：deadline（有截止的按剩余天数升序）/ newest / salary

### 4.4 常见修改操作

**新增页面**：`app/` 下建目录 + `page.tsx`，组件放 `components/`，加 Nav 链接（`components/Nav.tsx` 的 LINKS 数组）。

**改筛选条件**：改 `lib/jobs.ts` 的 `JobFilter` 类型 + `filterJobs()` + 前端筛选 UI（`HomeClient.tsx`）。

**改岗位卡片**：`components/JobCard.tsx` + `lib/jobs.ts` 的 `toView()` 字段映射。

**改动态背景**：`components/HeroBackground.tsx`（光斑颜色/网格参数/粒子采样密度）。

**改全站样式**：`app/globals.css`（CSS 变量在 `:root`）。

## 5. 已知陷阱（踩过的坑，别再踩）

1. **globals.css 必须无 BOM 保存**（UTF-8 无 BOM），否则 `npm run build` 失败。改完检查文件编码。
2. **不要加 `force-dynamic`**：会覆盖 `unstable_cache` 的 revalidate 缓存，导致每页全量拉取 Supabase。
3. **飞书招聘系（{tenant}.jobs.feishu.cn）只有 Playwright 拦截 API 能抓到**，httpx/curl_cffi 一律 405/400。
4. **存储层已统一为 PostgresStorage（psycopg 直连 6543 pooler）**，不要再引入 sqlite/supabase-py 等第三套存储。
5. **TS 闭包里 canvas/wrap 可能为 null**，用 `!` 非空断言，否则类型检查报 TS18047。
6. **离屏 canvas + getImageData 采样粒子不可靠**（首次成功后续全 0），粒子 Logo 用 `logo.png` 图片采样。
7. **git 状态**：提交前 `git status` 检查，别把临时文件（截图等）commit 进去。

## 6. 设计资产

| 项 | 值 |
|---|---|
| 主色 | Charcoal `#171e19`（背景） |
| 强调色 | Vibrant Red `#ca0013`（CTA/品牌） |
| 辅助色 | Gray-Green `#b7c6c2`（边框/次要文字）、Off-White `#eeebe3`（正文） |
| 字体 | Nunito（标题）+ Noto Sans SC 思源黑体（正文） |
| 圆角 | 主卡 40px / 嵌套 24px |
| 断点 | 992px（桌面/移动分界，动态背景只 ≥992px） |
| Logo | `apps/web/public/logo.png`（锤子拟物风格，红 O + 对勾） |

## 7. 当前进度状态

**✅ 已可用**：岗位聚合（筛选/排序/分页/搜索/回到顶部）、求职看板（加入待投）、日历（默认今天 + ICS 订阅接口）、AI 匹配页、社区页、收藏页、品牌（Offer派 + Logo + 打字机口号）、首页动态背景、本地 git 备份。

**🔄 开发中/待完善**：动态背景交互调优、数据源扩充（企业官网覆盖更多行业）、AI 匹配真实能力（当前为轻量实现）。

**📋 规划中（未做）**：邮件提醒（SendGrid/Resend）、Web Push、用户登录体系、部署上线（Vercel + Railway 方案已调研）。

**数据现状**：云端 Supabase `jobs` 表 1000 条（福建三源 400 + 企业官网 600）。

## 8. 协作约定（必读）

1. **git**：每次改完自动本地 commit（`git add -A && git commit`），**不 push**；用户说"上传"才 `git push` 到 `https://github.com/Oo0520/offer-hui`。
2. **流程**：新功能/较大改动**先给方案让用户确认，再动手**。用户说"没让做不用直接开始"就停下。
3. **设计红线**：移动优先但这是**网站不是 App**；深色 Sophisticated Playful 风格；跳转官方入口、不截留简历、不碰 BOSS/智联。
4. **质量**：前端交付前必须 `npm run build` 零错误；数据改动用 `cli.py stats` 验证条数。
5. **沟通**：回复用中文，极简无废话。
