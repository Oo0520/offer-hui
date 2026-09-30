-- ============================================================
-- Offer派 · user_custom_jobs 补充筛选维度列
-- 说明：手动录入表单新增"行业/学历要求"，对齐首页筛选体系
--   industry: 19 类标准行业（INDUSTRY_LIST，空=未分类）
--   degree:   学历要求（不限/专科/本科/硕士/博士，空=学历不限）
-- ============================================================

alter table public.user_custom_jobs add column if not exists industry text;
alter table public.user_custom_jobs add column if not exists degree   text;
