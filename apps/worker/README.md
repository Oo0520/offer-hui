# OfferHub Worker · 数据管道

抓取 → 解析 → 去重入库 → 查询 的最小数据管道，为「Offer汇」应届生求职平台提供岗位数据。

## 数据源（真实可达、已验证）

| 源 | 类型 | 方式 | 状态 |
|---|---|---|---|
| 国家24365（job.ncss.cn） | 国家级平台 | JSONP 公开接口 | ✅ 已验证 |
| 哈尔滨工业大学（job.hit.edu.cn） | 高校就业网 | POST JSON 接口 | ✅ 已验证 |
| 北京大学（scc.pku.edu.cn） | 高校就业网 | HTML 列表（token 复杂） | ⚠️ 尽力解析 |
| 南京大学（job.nju.edu.cn） | 高校就业网 | Vue SPA（需挖 API） | 📌 框架预留 |

> 注意：多数高校就业网在公网不可达（教育网限制），本仓库已探明可达源并做成可插拔结构，新源在 `app/sources/` 下按 `base.py` 接口新增即可。

## 快速开始

```powershell
cd apps/worker
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# 抓取并入库（自动去重）
.\.venv\Scripts\python.exe cli.py crawl

# 查看库内岗位
.\.venv\Scripts\python.exe cli.py list --limit 20

# 查看统计
.\.venv\Scripts\python.exe cli.py stats
```

## CLI 命令

```
python cli.py crawl [--dry]   # 抓取；--dry 只统计不写库（验证用）
python cli.py list [--limit N] [--status published|expired]
python cli.py stats
```

## FastAPI 服务

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8123
```

- `GET /healthz` — 健康检查（含库内岗位总数）
- `POST /crawl?dry_run=false` — 触发抓取
- `GET /jobs?limit=50&status=published&source=hit` — 查询岗位

## 存储后端切换（SQLite → Supabase）

MVP 默认用 SQLite（`data/offer.db`），schema 与 Supabase 完全对齐，去重逻辑一致。

要接入真实 Supabase：
1. 在 [supabase.com](https://supabase.com) 创建项目，打开 SQL 编辑器运行
   `infra/supabase/migrations/202609040001_init.sql`（或 `supabase db push`）
2. 复制项目 `Settings → API` 里的 Project URL 与 service_role key
3. 编辑 `apps/worker/.env`：

```ini
STORAGE_BACKEND=supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

4. 重新 `python cli.py crawl` 即写入云端。存储层接口已统一，无需改业务代码。

## 去重与增量逻辑

- 唯一键：`(source, external_id)`，不同源同 ID 各自保留
- 内容哈希：`content_hash` 检测变化 → 变则 update，不变则 skip
- 增量清理：本次未出现的旧记录自动标记 `expired`

## 测试

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_ingest -v
```

覆盖：新增 / 重复跳过 / 内容更新 / 跨源保留 / 过期标记。

## 合规

- 仅抓取公开信息，官方接口优先，不碰 BOSS/智联等商业平台
- 独立 UA、源间限速（`REQUEST_DELAY`）、尊重 robots
- 每条记录保留 `source_url`（原始页面）+ `apply_url`（官方投递入口），不做招聘闭环
