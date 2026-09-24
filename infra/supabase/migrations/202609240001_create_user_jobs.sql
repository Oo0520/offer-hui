-- ============================================================
-- Offer派 · user_jobs 用户行为表（收藏 + 看板五列合一）
-- 说明：线上实际表结构，沉淀自 Supabase 生产库。
-- 旧 init.sql 里的 applications / saved_jobs 已废弃（保留空表不删）。
-- 前端：HomeClient / BoardClient / FavoritesClient 全部基于此表。
-- ============================================================

create table if not exists public.user_jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  status      text not null,
              -- star     = 收藏（♥）
              -- pending  = 待投
              -- applied  = 已投
              -- written  = 笔试
              -- interview= 面试
              -- offer    = Offer
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 唯一约束：同一用户对同一岗位可以同时有 star + pending 等多条不同 status
create unique index if not exists user_jobs_user_id_job_id_status_key
  on public.user_jobs (user_id, job_id, status);

-- 查询索引
create index if not exists user_jobs_user_id_idx        on public.user_jobs (user_id);
create index if not exists user_jobs_job_id_idx         on public.user_jobs (job_id);
create index if not exists user_jobs_user_id_status_idx on public.user_jobs (user_id, status);

-- RLS：用户只能读写自己的记录
alter table public.user_jobs enable row level security;

drop policy if exists user_jobs_all_own on public.user_jobs;
create policy user_jobs_all_own on public.user_jobs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
