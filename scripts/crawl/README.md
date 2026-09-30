# Offer派 生产爬虫（云环境/本地通用版）

本目录是**生产爬虫唯一版本**（2026-09-30 起，与仓库外 `E:\AIMemory\DaoBao\` 下脚本保持同步；仓库外为本地执行副本）。

## 文件
- `crawl-fjut.py`：福建理工大学 jysd 全板块增量爬虫（全职/实习/宣讲会/招聘会/招聘公告）
- `crawl-fjrclh.py`：福建人才联合网增量爬虫（校招职位/实习招聘/招聘会/宣讲会）
- `normalize.py`：城市/行业/公司性质归一化（自动定位仓库 `infra/classify/` 标准数据）
- `crawl_alert.py`：失败邮件告警（SMTP，静默降级）

## 依赖
```bash
pip install -r requirements.txt
```
（Python 3.10+；scrapling + httpx + curl_cffi/patchright/msgspec/browserforge——scrapling 0.4.x 的 StealthyFetcher 运行时依赖，0.4.15 未在包元数据声明，需显式安装）

### chromium 浏览器（fjut 的 StealthyFetcher 必需）
patchright 需 chromium 内核，首次安装：
```bash
export PLAYWRIGHT_BROWSERS_PATH=/home/user/.cache/ms-playwright   # 云电脑用户目录（无 sudo 环境必须指定，默认 /opt 只读）
python3 -m patchright install chromium
```
运行时**必须**带上同一个环境变量，否则 patchright 回落到系统默认只读路径报 `Executable doesn't exist`：
```bash
export PLAYWRIGHT_BROWSERS_PATH=/home/user/.cache/ms-playwright
python crawl-fjut.py
```

## 运行
```bash
python crawl-fjut.py
python crawl-fjrclh.py
```
两者独立增量，先跑 fjut 再跑 fjrclh 均可；数据直接 upsert 进 Supabase（jobs 表，on_conflict source+external_id）。

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
