# Offer派 生产爬虫（云环境/本地通用版）

本目录是**生产爬虫唯一版本**（2026-09-30 起，与仓库外 `E:\AIMemory\DaoBao\` 下脚本保持同步；仓库外为本地执行副本）。

## 文件
- `crawl-jysd.py`：jysd 平台通用多校爬虫（**fjut / jmu / xmu 三校**，5 板块：全职/实习/宣讲会/招聘会/招聘公告）
- `crawl-fjrclh.py`：福建人才联合网增量爬虫（校招职位/实习招聘/招聘会/宣讲会）
- `normalize.py`：城市/行业/公司性质归一化（自动定位仓库 `infra/classify/` 标准数据）
- `crawl_alert.py`：失败邮件告警（SMTP，静默降级）

> ⚠️ `crawl-fjut.py` 已于 **2026-10-10 退役删除**。它与 `crawl-jysd.py` 都写 `source=fjut`，
> 但解析结果不同（旧脚本的标题正则在标记改版后失配，只写空标题），
> 两者会让同一个 `content_hash` 互相覆盖、数据来回翻转。**fjut 现在只由 `crawl-jysd.py` 写入**，
> 页数覆盖也更全（job 80 页 vs 旧 12 页）。旧文件可从 git 历史取回。

## 依赖
```bash
pip install -r requirements.txt
```
（Python 3.10+；scrapling + httpx + curl_cffi/patchright/playwright/protego/msgspec/browserforge——scrapling 0.4.x 的 StealthyFetcher 运行时依赖，0.4.15 未在包元数据声明，需显式安装）

### 浏览器（StealthyFetcher 必需）
**优先复用本机已装的 Chromium 内核浏览器（Edge / Chrome），无需下载 Chromium。**

`crawl-jysd.py` 会自动按以下顺序探测并传 `executable_path` 给 `fetch()`：
`Edge (Program Files x86)` → `Edge (Program Files)` → `Chrome` → `Chrome (x86)`；都没有才回退到 scrapling 自带 Chromium。

也可用环境变量显式指定：
```bash
set OFFERHUI_BROWSER_EXE=D:\path\to\msedge.exe
```

> ⚠️ 注意：`SCRAPLING_EXECUTABLE_PATH` 这个环境变量**只被 scrapling 的 CLI / MCP 读取**，
> 直接调用 `StealthyFetcher.fetch()` 不会生效，必须在代码里传 `executable_path`。

只有在既没有 Edge 也没有 Chrome 的机器上，才需要下载自带 Chromium：
```bash
python -m patchright install chromium
```

## 运行
```bash
python crawl-jysd.py     # fjut + jmu + xmu 三校
python crawl-fjrclh.py   # 福州大学
```
两者独立增量；数据直接 upsert 进 Supabase（jobs 表，on_conflict source+external_id）。

调试单校时可只跑一所（日常调度留空跑全部）：
```bash
set OFFERHUI_SCHOOLS=fjut
python crawl-jysd.py
```

## 环境变量（必须，勿硬编码进 git）
脚本会读取脚本同级 `.env`（KEY=VALUE）或系统环境变量：
| 变量 | 说明 |
|---|---|
| `SUPABASE_SERVICE_KEY` | PostgREST service key，缺失则脚本拒绝启动 |
| `ALERT_MAIL_TO` / `ALERT_SMTP_HOST` / `ALERT_SMTP_PORT` / `ALERT_SMTP_USER` / `ALERT_SMTP_PASS` | 告警邮件（未配置仅打印提示，不阻塞主流程） |

`.env` 已被 gitignore，绝不提交仓库。

## 标准数据
`infra/classify/`（pcas.json 行政区划 / industries.json 行业 / city_aliases.json / company_types.json 公司性质映射）——`normalize.py` 从脚本位置向上自动查找，勿移动。

## 与定时任务
豆包定时任务（Offer派每日数据抓取刷新，12:00）执行：拉取本仓库 → 安装依赖 → 配置 .env → 依次运行两脚本 → 调 `GET /api/revalidate?secret=<ADMIN_TOKEN>` 刷新线上。
