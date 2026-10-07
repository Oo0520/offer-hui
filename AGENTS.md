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

# 注意：实际每日跑的爬虫脚本仓库内为准（scripts/crawl/）：
#   offer-hui\scripts\crawl\crawl-fjut.py
#   offer-hui\scripts\crawl\crawl-fjrclh.py
# 豆包定时任务执行的是仓库外本地副本，需与仓库同步（勿反向改副本）：
#   E:\01_AI_Workspace\AIMemory\DaoBao\crawl-fjut.py
#   E:\01_AI_Workspace\AIMemory\DaoBao\crawl-fjrclh.py
```

**数据流**：

```
豆包定时任务（每天 12:00 北京，跑在本地 Windows）
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
# 仓库内版本为准（scripts/crawl/），本地执行副本在仓库外需保持同步：
cd E:\01_AI_Workspace\AIMemory\DaoBao
offer-hui\apps\worker\.venv\Scripts\python.exe offer-hui\scripts\crawl\crawl-fjut.py
offer-hui\apps\worker\.venv\Scripts\python.exe offer-hui\scripts\crawl\crawl-fjrclh.py

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
| `fjut` | 福建理工大学就业网 | Scrapling StealthyFetcher，5 板块（全职/实习/宣讲会/招聘会/招聘公告） | `scripts/crawl/crawl-fjut.py`（豆包定时任务执行仓库外副本） |
| `fjrclh` | 福州大学就业网 | httpx API + 增量 | `scripts/crawl/crawl-fjrclh.py` |
| `fj99` | 福建就业网 | POST + md5 签名 | `run_fj99.py` |
| `xmu` / `jmu` | 厦门大学 / 集美大学就业网 | ⚠️ **代码不在本仓库**（2026-10-07 核查确认，见下） | 未知，需补录 |
| `campus2027` / `open_jobs` / `wechat` / `zhaopin_h5` | 开源社区 / 公众号 / 历史导入 | 历史导入 | `import_*.py` |

**数据源收口决策（2026-09-28 确认，2026-10-07 修正）**：
- 生产实际只跑 `crawl-fjut.py` + `crawl-fjrclh.py`（豆包定时任务 12:00 调用）。**权威版本在仓库内 `scripts/crawl/`**（2026-09-30 迁仓，PR #35）；仓库外 `E:\01_AI_Workspace\AIMemory\DaoBao\` 下同名文件只是**本地执行副本，须与仓库同步，不得反向改副本**。
- 仓库外 `apps/worker/crawl_fjut.py` / `crawl_fjrclh.py` / `crawl_fair.py` 为旧副本，已删除。
- **hit / pku / ncss / feishu 四个源已停用**：`apps/worker/app/sources/` 下对应文件（hit.py / pku.py / ncss.py / feishu.py）已删除，无代码引用；库内历史数据保留不更新。
- **scheduler.py 标注「备用，不启用」**：生产调度 = 豆包定时任务，不是 scheduler.py。
- `run_fj99.py` 等仓库内脚本仅按需手动执行，不进定时任务。
- ⚠️ **`xmu` / `jmu` 源代码不在本仓库**（2026-10-07 实测：仓库全分支、全盘脚本、git 历史均无 `jy.xmu.edu.cn` / `xsjyzd.jmu.edu.cn` 抓取代码），但库内 3109 条数据且 2026-10-06 仍在更新——存在一条未被记录的生产管线，代码位置待补。

**爬虫性能基线（2026-09-29 实测，目标 4 验收）**：
- **写入**：批量 upsert/PATCH 对比逐条，20 条同批实测 **0.88s vs 16.85s（快 19.1 倍）**，往返次数降 20 倍。
- **全量时长**：fjut 详情页并发化（线程池 5，每线程独立 StealthyFetcher）后 **1031s → 232s（降 77.5%）**；幂等不回归：`新增:0 变更:0 跳过:348 失败:0`。
- 备份：`crawl-fjut.py.bak-20260928-concurrent`（改造前）、`crawl-fjrclh.py.bak-20260927`（逐条版）。
- fjrclh 为 API 抓取（全量约 40s），未并发化，无必要。

**前端性能阈值基线（2026-09-29 实测，目标 5 验收，数据量 2620 条）**：
- **5 个静态页首屏 HTML 体积**：`/` 1740 KB、`/calendar` 1708 KB、`/match` 1708 KB、`/favorites` 1706 KB、`/board` 1707 KB（全量岗位打包进每页 RSC payload）；**gzip 传输均 ~190 KB**，TTFB+下载 0.4s。
- **DOMContentLoaded 172-392ms、loadEventEnd 220-393ms**；页面资源 58 个共 834KB；LCP 在无头浏览器未能稳定捕获（文本为主页面，近似 DCL）。
- **筛选耗时：2620 条组合 filter 单次 0.2-0.5ms**（纯 JS 内存计算，非瓶颈）。
- **阈值规则（评审通过，本期不实现）**：数据量 **> 5000 条**时，将筛选/分页从浏览器端全量 filter 切换为服务端 PostgREST 参数化查询（`/api/v1/jobs` 加 city/industry/degree/job_type 参数 + limit/offset 分页），首屏 RSC 只带前 N 条 + 计数；切换前先跑一次本基线对比。

**新数据源接入**：写独立脚本 → upsert 到 jobs 表 → 在豆包定时任务里加一步（任务标题「Offer派每日数据抓取刷新」，cron `0 12 * * *` Asia/Shanghai，跑在本地 Windows，2026-09-28 用户确认）。爬虫跑完后调用 `GET https://www.offerpiai.cn/api/revalidate?secret=<ADMIN_TOKEN>` 立即失效缓存（无需 git push / 重新 build）。

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
2. **Vercel Node runtime 支持 unstable_cache**：岗位数据走 build 时静态打包（revalidate: false）。**不要加 force-dynamic 到静态页**。数据更新靠豆包定时任务每天 12:00 跑爬虫 upsert 到 Supabase，然后**调用 `/api/revalidate?secret=<ADMIN_TOKEN>` 按需失效缓存**（接口内部 `revalidateTag("jobs", {expire:0})` + `revalidatePath` 各静态页），300ms 内全球生效，无需重新 build。
3. **SERVICE_KEY 绝不能加 NEXT_PUBLIC_ 前缀**，否则暴露浏览器。
4. **爬虫跑在豆包本地定时任务**：任务名「Offer派每日数据抓取刷新」，cron `0 12 * * *` Asia/Shanghai（2026-09-28 用户确认），跑在本地 Windows。依赖电脑开机且豆包在线。**权威代码在仓库 `scripts/crawl/`**，定时任务执行的是仓库外副本 `E:\01_AI_Workspace\AIMemory\DaoBao\crawl-fjut.py` / `crawl-fjrclh.py`（改代码只改仓库侧，跑完手动同步副本）。跑完调用 `/api/revalidate` 失效缓存（不再 push 空 commit 触发 redeploy）。
5. **PowerShell 中文编码**：读含中文的 .py/.md 文件用 `[System.IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)`，不要用 Get-Content 管道（默认 ANSI 会乱码）。
6. **git commit 格式**：`[YYYY-MM-DD HH:mm] type: 描述`，方便时间轴回溯。
7. **端口占用**：改完代码重启前先杀 3000 端口旧进程（`Get-NetTCPConnection :3000 | Stop-Process`），否则旧进程占着端口跑老代码。
8. **Vercel 环境变量**：4 个 Supabase 变量必须配全，少一个 build 就挂。CI 里用 placeholder URL（`https://placeholder.supabase.co`）做 build 降级，见 `apps/web/lib/jobs.ts` 里 `_fetchAllJobsRaw` 的 try/catch。
9. **user_jobs 表 RLS**：新环境建表后必须加 `using (auth.uid() = user_id)` 的 RLS 策略，否则 anon key 能读全表。
10. **PR 流程**：不直接 push main，走分支 + PR；用户说"合并"才合。
11. **城市/行业标准化（2026-09-29 落地）**：
    - 标准数据在 `infra/classify/`：`pcas.json`（民政部行政区划，省→市→区三级，来源 modood/Administrative-divisions-of-China）、`industries.json`（21 类目 + 关键词映射，含英文关键词）、`city_aliases.json`（英文/脏变体→标准中文）。
    - 归一化函数在仓库 `scripts/crawl/normalize.py`（`normalize_city` / `normalize_industry` / `normalize_company_type`），两个生产爬虫已接入（city 入库前归一化）。
    - 存量清洗结果：2620 条中 city 601 条、industry 1663 条改写；city distinct 277→156、industry 69→19。
    - **pcas.json 重庆市下有分组键"县"**，加载时必须跳过（`city_short in ("县","区","旗")`），否则单字"县"混入城市集导致脏值。
    - **同名多义区县**（鼓楼/台江/新兴等全国多个）用 `_district_name_count` 统计次数，>1 的不建区县→市索引，避免归错市（曾把福州鼓楼区归到开封）。
    - **"安全公司"关键词在政府类目会吞掉"安全公司&软件公司&云服务"这类 IT 岗**，已移到"互联网/AI/IT"。
    - jysd 详情页薪资正则已删除（页面无结构化薪资区，只会命中 base64 碎片抖动 hash）；fjrclh 是 API 结构化数据不受影响。
    - 前端 `dimOptions`（lib/jobs.ts）直接 distinct 库值，数据标准化后筛选面板自动规范，无需改前端逻辑。
    - **前端交互（2026-09-29 追加）**：城市筛选改三级联动（`components/CityFilterPanel.tsx`，数据 `lib/cityTree.ts` 由 `scripts/gen-citytree.py` 从 pcas.json 生成，全国/热门 + 省份折叠展开）；公司性质拆独立维度（jobs 表新增 company_type 列，迁移见 `infra/supabase/migrations/202609290003_company_type.sql`，`normalize_company_type()` 归一化，industries.json 已移除"外企/合资""国企/央企"类目）。订阅面板（CalendarClient）与首页共用 CityFilterPanel；subscriptions.filters 含 company_types，ICS 服务端同步过滤。
12. **生产爬虫（`scripts/crawl/crawl-fjut.py` / `crawl-fjrclh.py`）与 `models.py` 的 hash 口径必须一致**：content_hash 用 SHA1 + `json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)`（十键 payload：title/company/city/industry/degree/salary[min,max]/salary_text/deadline/apply/tags，None 归一为 ""/[]/0，posted_at 不进 hash）。改任一侧的归一逻辑都会导致全量误判「变更」。另注意：① PostgREST 批量 upsert 用 `POST /jobs?on_conflict=source,external_id` + `Prefer: resolution=merge-duplicates`，`tags` 为 jsonb NOT NULL，Python 侧 None 必须兜底 `[]`，否则 400；② 脚本 SERVICE_KEY 从 `.env`/环境变量读，勿再加回纯硬编码；③ fjrclh 源站 WAF 拦 python 默认 UA，httpx 必须带浏览器 User-Agent；④ **fjut 详情页 HTML 解析前必须剥离 base64/渲染数据**：页面内联大量 base64（图片/统计像素/压缩 JS），其中随机出现「数字K」，且存在 <200 字符的短碎片，任何「全页搜数字K」式 salary 匹配都会命中随机值 → content_hash 抖动。jysd 页面**根本没有结构化薪资区**，fjut 源 salary_text 恒 None（2026-09-28 诊断实锤，七跑验证幂等 `变更:0, 跳过:348`）；诊断同类抖动的方法：一次性脚本抓单页，打印各正则命中与库里值对比，跨两次抓取看哪个字段漂移。
13. **仓库内外脚本不同步是真实事故源（2026-10-07 实测）**：仓库外副本一度落后仓库两个版本（缺 company_type 修复、日期正则更严、`normalize.py` 硬编码 `../offer-hui/infra/classify` 路径、`crawl_alert.py` 只读同级 .env）。**改爬虫只改 `scripts/crawl/`，改完用 SHA256 对比并覆盖同步仓库外副本**；豆包定时任务跑的是仓库外副本。
14. **数据质量红线（2026-10-07 实测 5808 条）**：`city` 出现 >8 字的脏值 403 条（占 6.9%），主要是 xmu/jmu 源把招聘标题/场地地址整段塞进 city（如"线下\n…\n中国农业发展银行2027年度校园招聘宣讲"），前端三级联动城市筛选会直接被撑爆。新增数据源**入库前必须过 `normalize_city`**，且 city 长度 >8 视为解析失败。

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
- **豆包定时任务爬虫**（每天 12:00 北京自动跑增量 + `/api/revalidate` 失效缓存）
- **`/api/revalidate` 按需失效缓存**（修复「爬虫已入库但网站不更新」：unstable_cache 跨部署持久，需主动失效）
- **城市/行业数据标准化**（民政部 pcas.json + GB/T4754 骨架行业树 + 别名表；存量清洗 city 277→156 / industry 69→19；爬虫入库前归一化；前端筛选自动规范，无英文/无重复/无拼接脏值）
- **前端筛选交互升级**（城市「全国>省>市」三级联动；公司性质独立维度 company_type，外企/合资 460 条迁移）

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
