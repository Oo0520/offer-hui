-- ============================================================
-- Offer派 · user_custom_jobs 用户手动录入岗位表
-- 说明：求职看板"＋手动录入"产生的私有岗位。
--   submit_status:
--     private   = 仅自己看板可见（未投稿）
--     pending   = 已投稿待审核（网站公开列表不可见）
--     published = 审核通过，已写入 jobs 表（published_job_id 关联）
--     rejected  = 被驳回（可修改后重新投稿）
--   stage: pending/applied/written/interview/failed/offer（与看板 6 列一致）
-- ============================================================

create table if not exists public.user_custom_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  company          text not null,
  title            text not null,
  company_type     text,                -- 外企/合资、国企/央企、民企/私企、上市公司/500强
  recruit_type     text,                -- 实习、秋招、春招、校招
  cohort           text,                -- 2027届、2026届、2025届、不限
  city             text,
  deadline_at      date,
  apply_url        text not null,
  note             text,
  stage            text not null default 'pending',  -- 看板阶段
  submit_status    text not null default 'pending',  -- private/pending/published/rejected
  published_job_id uuid references public.jobs(id) on delete set null,  -- 审核通过后关联的公开岗位
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists user_custom_jobs_user_id_idx       on public.user_custom_jobs (user_id);
create index if not exists user_custom_jobs_submit_status_idx on public.user_custom_jobs (submit_status);

alter table public.user_custom_jobs enable row level security;

drop policy if exists user_custom_jobs_all_own on public.user_custom_jobs;
create policy user_custom_jobs_all_own on public.user_custom_jobs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 管理员（service key）可读所有投稿：service key 绕过 RLS，无需额外 policy。

-- ============================================================
-- jobs 表加 submitted_by：标记用户投稿来源，便于追溯与贡献榜
-- ============================================================
alter table public.jobs add column if not exists submitted_by uuid references auth.users(id) on delete set null;
