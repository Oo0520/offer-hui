# Changelog

本项目版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)，变更记录遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

当前尚无正式 Release，所有变更集中在 `Unreleased`。

## [Unreleased]

### 新增

- **岗位聚合浏览**：多数据源爬虫聚合校招 / 实习 / 招聘会 / 宣讲会信息
  - 数据源：福建理工大学就业网（fjut）、福州大学人才在线（fjrclh）、福建就业平台（fj99）、国家 24365（ncss）、企业官网（蔚来 / 小米 / 小鹏，经飞书招聘 feishu）
  - 筛选：关键词、招聘类型、城市、行业、届别、学历（不限 / 专科及以上 / 本科及以上 / 硕士及以上）
  - 排序：按截止日期 / 最新发布 / 薪资
  - 分页浏览，移动端优先
- **校招日历 + ICS 订阅**：`GET /api/calendar.ics`，支持导入手机日历获取 DDL 提醒（无需登录）
- **求职看板**：待投 / 已投 / 笔试 / 面试 / Offer 全流程管理，登录后多端数据同步
- **账号系统**：Supabase Auth（邮箱注册 / 登录），RLS 私有数据隔离
- **收藏功能**：岗位收藏与取消，登录后多端同步
- **AI 匹配页**：五维规则引擎 MVP（届别 / 学历 / 行业 / 城市 / 关键词），简历本机处理不上传
- **轻社区**：薪资 / 面经 / 内推码帖子，先审后发（pending / approved / rejected）
- **Agent 接入（MCP）**：FastMCP 服务（:8001），向 Codex / Claude / Kimi / DeepSeek Harness / Gemini / 豆包等 AI 助手开放 `query_jobs` / `get_job_detail` / `get_sources` / `get_stats`
- **手动配置管理端**：`/offerp` 后台人工录入 / 管理岗位数据
- **品牌与视觉**：Offer派 Logo、打字机 slogan（"不错过每一个 Offer / 陪你拿到第一个 Offer / 别慌，Offer 在路上"）、首页动态交互背景（桌面端）
- **数据管道**：`apps/worker` Python 爬虫框架（cli.py：`crawl` / `list` / `stats` / `scheduler`），`content_hash` + `UNIQUE(source, external_id)` 去重，增量更新与每日定时任务

### 修复

- 岗位卡片长名称与 UI 重叠问题（二列布局 + 对齐）
- 筛选展开与内容重叠问题（移动端）
- 招聘会 / 宣讲会数据混排与过期数据（仅保留有效信息，学校筛选限定相关院校）
- 日历默认显示今日、订阅 URL 引导
- 本地与远程（内网穿透）打字机 slogan 表现不一致
- Windows 下 `globals.css` 编码导致 `next build` 失败（需 UTF-8 with BOM）

### 变更

- 数据源合规收紧：遵守 robots.txt、请求限速（REQUEST_DELAY）、独立 UA；不碰 BOSS / 智联等反爬严格平台
- 学历筛选收敛为"不限 / 专科及以上 / 本科及以上 / 硕士及以上"，避免重复项
- 跳转统一指向企业官方招聘入口（如蔚来 `https://nio.jobs.feishu.cn/campus`）
- 移除哈工大就业网数据源（按维护者要求）

### 文档

- 新增 [README.md](./README.md)（英文）与 [README.zh-CN.md](./README.zh-CN.md)
- 新增 [AGENTS.md](./AGENTS.md)（面向 Agent 的协作文档）
- 新增 CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / SUPPORT 等社区规范文件
- 新增 [LICENSE](./LICENSE)（MIT）

### 待办（规划中）

- 邮件提醒（SendGrid / Resend）
- Web Push 浏览器通知
- AI 匹配正式版：规则 → spaCy NER → LLM 兜底解析 + pgvector 向量检索 + LLM 仅对 top-10 生成匹配理由
- 搜索引擎（Meilisearch / Typesense）中文分词检索
- 正式部署上线（Vercel + Railway / Cloud Run 已调研）
