-- ============================================================
-- Offer汇 · 初始 schema
-- 说明：执行 `supabase db push` 或在本库 SQL 编辑器运行。
-- worker 通过 service_role 写入，Web 前端通过 anon + RLS 读取。
-- ============================================================

create extension if not exists vector;

-- ---------- 公司 ----------
create table if not exists companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text unique,
  industry    text,
  logo_url    text,
  website     text,
  verified    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_companies_industry on companies(industry);

-- ---------- 岗位（核心表） ----------
create table if not exists jobs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies(id) on delete set null,
  source      text not null,                       -- ncss | hit | pku | ...
  source_url  text not null unique,                -- 原始页面
  external_id text not null,                       -- 源站唯一 ID
  title       text not null,
  description text,
  city        text,
  province    text,
  industry    text,
  job_type    text,                                -- campus | intern | fair
  degree      text,
  cohort      text,                                -- 如 2027届
  salary_min  numeric,
  salary_max  numeric,
  salary_text text,
  deadline_at timestamptz,                         -- 截止（DDL）
  posted_at   timestamptz,                         -- 发布
  apply_url   text not null,                       -- 官方投递入口（不截留）
  status      text not null default 'published',   -- published | expired | archived
  is_hot      boolean not null default false,
  is_intern   boolean not null default false,
  tags        jsonb not null default '[]',
  content_hash text,
  embedding   vector(1536),                        -- AI 匹配（pgvector）
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_jobs_source_external unique (source, external_id)
);
create index if not exists idx_jobs_deadline  on jobs(deadline_at);
create index if not exists idx_jobs_posted    on jobs(posted_at desc);
create index if not exists idx_jobs_status    on jobs(status);
create index if not exists idx_jobs_city      on jobs(city);
create index if not exists idx_jobs_industry  on jobs(industry);
create index if not exists idx_jobs_jobtype   on jobs(job_type);
create index if not exists idx_jobs_cohort    on jobs(cohort);
create index if not exists idx_jobs_company   on jobs(company_id);
create index if not exists idx_jobs_tags      on jobs using gin(tags);
-- 数据量大后启用向量索引（MVP 数据量小可暂缓）：
-- create index on jobs using hnsw (embedding vector_cosine_ops);

-- ---------- 用户扩展 ----------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  university  text,
  major       text,
  cohort      text,
  avatar_url  text,
  resume_url  text,
  created_at  timestamptz not null default now()
);

-- ---------- 提醒订阅 ----------
create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  filters       jsonb not null default '{}',   -- {cities:[],industries:[],job_types:[],cohort:"2027届"}
  email         text,
  push_sub      jsonb,                          -- Web Push subscription
  ics_token     text unique,                    -- 日历订阅令牌
  ics_enabled   boolean not null default false,
  next_check_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_subs_user on subscriptions(user_id);

-- ---------- 收藏 / 投递 ----------
create table if not exists saved_jobs (
  user_id     uuid references auth.users(id) on delete cascade,
  job_id      uuid references jobs(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, job_id)
);

create table if not exists applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  job_id      uuid references jobs(id) on delete cascade,
  stage       text not null default 'applied',  -- applied/written/interview/offer/removed
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, job_id)
);
create index if not exists idx_apps_user_stage on applications(user_id, stage);

-- ---------- 简历 ----------
create table if not exists resumes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  version       int not null default 1,
  file_name     text,
  storage_path  text,                            -- Supabase Storage
  parsed_text   text,
  embedding     vector(1536),
  status        text not null default 'parsing', -- parsing/ready/failed
  created_at    timestamptz not null default now()
);
create index if not exists idx_resumes_user on resumes(user_id);

-- ---------- 社区（先审后发） ----------
create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid references auth.users(id) on delete cascade,
  title        text not null,
  content      text not null,
  tag          text,
  company      text,
  reward       boolean not null default false,
  views        int not null default 0,
  likes_count  int not null default 0,
  status       text not null default 'pending',  -- pending/approved/rejected
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_posts_status on posts(status, created_at desc);

create table if not exists post_likes (
  post_id     uuid references posts(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------- 爬虫监控 ----------
create table if not exists crawl_sources (
  id                uuid primary key default gen_random_uuid(),
  name              text,
  kind              text,                        -- university/corporate/ncss
  base_url          text,
  robots_allowed    boolean not null default true,
  active            boolean not null default true,
  last_run_at       timestamptz,
  last_success_at   timestamptz,
  last_content_hash text,
  created_at        timestamptz not null default now()
);

create table if not exists crawl_runs (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references crawl_sources(id) on delete set null,
  started_at   timestamptz,
  finished_at  timestamptz,
  status       text,                             -- running/success/failed
  items_found  int,
  items_new    int,
  items_updated int,
  items_failed int,
  error        text
);
create index if not exists idx_runs_source on crawl_runs(source_id, started_at desc);

-- ============================================================
-- RLS：岗位/公司公开可读；用户私有数据仅本人可见
-- ============================================================
alter table companies enable row level security;
alter table jobs enable row level security;
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table saved_jobs enable row level security;
alter table applications enable row level security;
alter table resumes enable row level security;
alter table posts enable row level security;
alter table post_likes enable row level security;

-- 公开读
drop policy if exists "jobs public read" on jobs;
create policy "jobs public read" on jobs for select using (status = 'published');
drop policy if exists "companies public read" on companies;
create policy "companies public read" on companies for select using (true);

-- 用户私有数据：仅本人
drop policy if exists "profiles own" on profiles;
create policy "profiles own" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "subs own" on subscriptions;
create policy "subs own" on subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "saved own" on saved_jobs;
create policy "saved own" on saved_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "apps own" on applications;
create policy "apps own" on applications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "resumes own" on resumes;
create policy "resumes own" on resumes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 社区：已审核帖子公开读；本人写/改自己帖子
drop policy if exists "posts public read" on posts;
create policy "posts public read" on posts for select using (status = 'approved');
drop policy if exists "posts own write" on posts;
create policy "posts own write" on posts for insert with check (auth.uid() = author_id);
drop policy if exists "post_likes own" on post_likes;
create policy "post_likes own" on post_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
