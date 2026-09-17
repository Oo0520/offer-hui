# Offer派 · OfferPai

> 不错过每一个 Offer · 陪你拿到第一个 Offer · 别慌，Offer 在路上

**Offer派** is a public-welfare campus recruitment / internship information aggregator for Chinese fresh graduates. It aggregates job postings from university career centers, the national 24365 platform and corporate official recruiting pages — with filters, DDL calendar subscription, a job application board, lightweight AI matching and a community. **All postings link to the official application entry; no resumes are collected.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.4-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase)](https://supabase.com)
[![Python](https://img.shields.io/badge/Python-3-3776AB?logo=python)](https://www.python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Demo / Screenshot

- Live demo: **TODO** (currently served via temporary Cloudflare Tunnel — ask the maintainer for a fresh URL, or run locally)
- UI screenshot: [`ui-check.png`](./ui-check.png) · Logo: [`logo.png`](./logo.png)

---

## Features

- **Job aggregation** — multi-source crawler: university career centers (Fujian University of Technology, Fuzhou University), Fujian employment platforms, national 24365, corporate official recruiting pages (NIO / Xiaomi / XPeng via Feishu jobs)
- **Filters & search** — by keyword, job type (校招/实习/招聘会/宣讲会), city, industry, cohort (届别) and degree level; sort by deadline / newest / salary
- **Campus calendar + ICS subscription** — `GET /api/calendar.ics` serves an iCalendar feed for DDL reminders
- **Job application board** — track 待投 / 已投 / 笔试 / 面试 / Offer stages (login required, data synced across devices via Supabase)
- **Lightweight AI matching** — five-dimension rule scoring (MVP), resume is processed locally and never uploaded
- **Community** — salary / interview experience / referral-code posts, moderated before publishing
- **Agent access (MCP)** — a FastMCP server exposing jobs data to any AI assistant (Codex / Claude / Kimi / DeepSeek Harness / Gemini / Doubao)
- **Official links only** — every posting carries its source and jumps to the official apply URL; no resume interception
- **Compliance-first crawling** — respects `robots.txt`, per-source request delay, dedicated User-Agent, dedupe by `content_hash` + `UNIQUE(source, external_id)`

---

## Tech Stack

| Layer | Tech | Location |
|---|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 | `apps/web/` |
| Database / Auth | Supabase Postgres (pgvector, RLS) | cloud `sqmgjxazzpcfjutzscyu` |
| Crawler / pipeline | Python · httpx · curl_cffi · Playwright · psycopg · APScheduler · FastAPI | `apps/worker/` |
| Agent access | FastMCP (Streamable HTTP) | `apps/mcp/` |
| Data cache | Next.js `unstable_cache` (60s ISR) | `apps/web/lib/jobs.ts` |
| Package manager | pnpm workspace (`apps/*`) | root |

---

## Repository Layout

```
offer-hui/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/              # 12 routes + API routes (v1/jobs, calendar.ics, offerp/*)
│   │   ├── components/       # Nav / HomeClient / JobCard / BoardClient / ...
│   │   └── lib/              # jobs.ts (data layer) / supabase.ts / ratelimit.ts
│   ├── worker/               # Python crawler & data pipeline
│   │   ├── app/              # config / ingest / storage / models
│   │   ├── app/sources/      # one file per source (fjut, fjrclh, fj99, feishu, ncss, hit, pku, ...)
│   │   ├── cli.py            # CLI entry (crawl / list / stats / scheduler)
│   │   └── scheduler.py      # daily scheduled crawl
│   └── mcp/                  # FastMCP server (Agent access, port 8001)
├── infra/supabase/migrations/ # SQL schema + RLS (202609040001_init.sql)
├── AGENTS.md                 # collaboration doc for agents
├── start_all.bat             # one-click start: MCP + web + tunnels
└── check_urls.bat            # print current public tunnel URLs
```

---

## Installation

Prerequisites: Node.js 18+, pnpm, Python 3.10+ (TODO: confirm exact minimum).

### Frontend

```bash
cd apps/web
npm install        # or: pnpm install
```

### Crawler worker

```powershell
cd apps/worker
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### MCP server

MCP dependencies reuse the worker venv (installed in the step above) — `requirements.txt` at `apps/mcp/` lists `fastmcp`, `psycopg`, `python-dotenv`.

---

## Quick Start

### 1. Configure environment

Copy and fill the env files (never commit real secrets):

| File | Variables |
|---|---|
| `apps/web/.env.local` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| `apps/worker/.env` | `STORAGE_BACKEND` (postgres/sqlite), `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `USER_AGENT`, `REQUEST_DELAY`, `MAX_ITEMS_PER_SOURCE` |

See `apps/worker/.env.example` for the worker template.

### 2. Init database

Run the migration SQL on your Supabase project:

```
infra/supabase/migrations/202609040001_init.sql
```

### 3. Run the web app

```bash
cd apps/web
npm run dev        # http://localhost:3000
```

### 4. Crawl data (optional, worker)

```powershell
cd apps/worker
.\.venv\Scripts\python.exe cli.py crawl            # full crawl & upsert
.\.venv\Scripts\python.exe cli.py stats            # DB stats
.\.venv\Scripts\python.exe cli.py list --limit 20  # list jobs
```

### 5. Start MCP server (optional, Agent access)

```powershell
cd apps/mcp
..\worker\.venv\Scripts\python.exe server.py --port 8001
```

### 6. One-click start (Windows)

```bat
start_all.bat    # MCP :8001 + Web :3000 (production) + tunnels
check_urls.bat   # print the current public URLs
```

---

## Configuration

All configuration is read from `.env` files via `python-dotenv` / Next.js env handling. Sensitive keys never appear in code.

| Setting | Default | Purpose |
|---|---|---|
| `STORAGE_BACKEND` | `sqlite` | `postgres` / `sqlite` storage backend for the worker |
| `DB_PATH` | `data/offer.db` | local SQLite path |
| `DATABASE_URL` | — | Postgres direct connection (psycopg, pooler `:6543`) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | — | Supabase project credentials |
| `USER_AGENT` | Chrome UA | crawler UA |
| `REQUEST_DELAY` | `1.2` | seconds between requests (rate limiting) |
| `MAX_ITEMS_PER_SOURCE` | `30` | per-source item cap |

Frontend API rate limit: 60 req/min per IP (`apps/web/lib/ratelimit.ts`). MCP rate limit: 120 calls / 60s.

---

## Usage Examples

### Web

- Browse & filter jobs at `/` (keyword, job type, city, industry, cohort, degree; sort by deadline/newest/salary)
- Subscribe to the calendar at `/calendar` via the ICS link
- Track applications at `/board` (login required)
- Try AI matching at `/match` (local rule engine, example profile included)
- Read Agent integration guide at `/agents`

### REST API

```bash
# list jobs with filters
curl "http://localhost:3000/api/v1/jobs?job_type=campus&city=福州&sort=deadline&page=1&page_size=20"

# job detail
curl "http://localhost:3000/api/v1/jobs/<id>"

# data sources & counts
curl "http://localhost:3000/api/v1/sources"

# stats
curl "http://localhost:3000/api/v1/stats"

# calendar feed
curl "http://localhost:3000/api/calendar.ics"
```

### Worker FastAPI (port 8123)

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8123
```

- `GET /healthz` — health check with job count
- `POST /crawl?dry_run=false` — trigger a crawl
- `GET /jobs?limit=50&status=published&source=hit` — query jobs

### MCP tools (Agent access)

| Tool | Purpose | Key params |
|---|---|---|
| `query_jobs` | list + filter + sort + paginate | `city` / `cohort` / `degree` / `job_type` / `keyword` |
| `get_job_detail` | single job detail | `job_id` |
| `get_sources` | source list + counts | — |
| `get_stats` | DB stats | — |

Add to your MCP client (`mcp.json`):

```json
{
  "mcpServers": {
    "offerp": { "type": "http", "url": "http://localhost:8001" }
  }
}
```

---

## API Reference

### `GET /api/v1/jobs`

| Param | Type | Description |
|---|---|---|
| `q` | string | keyword search |
| `job_type` | string | 校招 / 实习 / 招聘会 / 宣讲会 |
| `city` | string | city filter |
| `industry` | string | industry filter |
| `cohort` | string | cohort (e.g. 2027届) |
| `degree` | string | 不限 / 专科及以上 / 本科及以上 / 硕士及以上 |
| `sort` | string | `deadline` / `newest` / `salary` |
| `page` | int | 1-based (default 1) |
| `page_size` | int | 1–50 (default 20) |

Response: `{ code, data: { items: JobView[], total, page, page_size } }` (TODO: confirm exact envelope).

### `GET /api/calendar.ics`

Returns an iCalendar feed of job deadlines for calendar subscription.

### DB schema (core tables)

`companies`, `jobs` (with `content_hash`, `embedding vector(1536)`), `profiles`, `subscriptions`, `saved_jobs`, `applications`, `resumes`, `posts`, `post_likes`, `crawl_sources`, `crawl_runs` — RLS: jobs/companies public read; user tables private to owner.

---

## Architecture

```
Crawler (apps/worker, Python)
   │  httpx / curl_cffi / Playwright
   ▼
Supabase Postgres  ── content_hash dedupe, UNIQUE(source, external_id)
   │
   ├──► Next.js unstable_cache (60s) ──► REST /api/v1/* ──► Frontend components
   │
   └──► MCP Server (apps/mcp, :8001) ──► AI Agents (query_jobs / get_job_detail / ...)
```

Data flow: **crawl → parse → dedupe & upsert → serve (web REST / MCP) → frontend render**.

Scheduled crawling: `python cli.py scheduler` (APScheduler, default daily 02:00; `--now` to run once immediately).

---

## FAQ

**Where does the data come from?**
University career centers (Fujian University of Technology, Fuzhou University), Fujian employment platforms (fj99), national 24365 (NCSS), and corporate official recruiting pages (NIO / Xiaomi / XPeng via Feishu). Every record carries its source and the official apply URL.

**Is the AI matching using a real LLM?**
Not yet. The MVP uses a five-dimension rule engine (cohort / degree / industry / city / title keywords) that runs locally — the resume is never uploaded. The roadmap is rule → spaCy NER → LLM fallback parsing, pgvector embedding retrieval, and LLM-generated reasons for the top-10 matches. The `jobs.embedding` column is already in the schema.

**Do you collect resumes?**
No. All postings link to the official application entry. The project is public-welfare and non-profit.

**How do I subscribe to DDL reminders without login?**
Use the ICS feed (`/api/calendar.ics`) and import it into your phone calendar.

**Why is some data missing or outdated?**
Crawling is a work in progress; sources can change their interfaces. Reports are welcome via Issues.

**Windows-specific issues?**
`globals.css` must be saved as UTF-8 with BOM or `npm run build` fails. Feishu job pages can only be crawled with Playwright API interception (httpx/curl_cffi get 405/400).

---

## Contributing

1. Fork the repo and create a feature branch.
2. New data source: create `apps/worker/app/sources/<name>.py` following `base.py` (BaseSource with UA/rate-limit/Referer), register it in `ingest.py` `get_sources()`, then verify with `cli.py crawl --dry`.
3. Frontend changes: pages under `apps/web/app/`, components under `apps/web/components/`, data layer in `apps/web/lib/jobs.ts`.
4. Run `npm run build` (must be error-free) and `python cli.py stats` to verify counts before delivery.
5. Open a Pull Request. Commit messages follow the format `[YYYY-MM-DD HH:mm] type: description`.

TODO: contribution guidelines / CODE_OF_CONDUCT.

---

## License

Released under the [MIT License](./LICENSE) — free to use, modify and distribute for any purpose, including commercial. The project itself remains public-welfare / non-profit.

---

## Project Status

- ✅ Available: job aggregation + filters/sort/pagination, calendar + ICS, application board (sync across devices), AI matching page, community page, favorites, brand & typewriter slogan, home animated background, local git backups, MCP Agent access
- 🚧 In progress: background interaction polish, data source expansion, real AI matching (pgvector + LLM)
- 📋 Planned: email reminders (SendGrid/Resend), Web Push, deployment (Vercel + Railway researched)
