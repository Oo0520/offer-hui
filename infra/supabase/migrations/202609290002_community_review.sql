-- ============================================================
-- 202609290002_community_review.sql
-- 目标9：社区先审后发闭环加固
-- 1) posts insert 强制 status='pending'，杜绝用户绕过审核直接发 approved
-- 2) 明确禁止普通用户 update/delete posts（仅 service key 可审）
-- 3) post_likes 保持原策略
-- ============================================================

-- 移除旧策略，重建
drop policy if exists "posts own write" on posts;
create policy "posts own write" on posts
  for insert
  with check (auth.uid() = author_id and status = 'pending');

-- 普通用户不可修改/删除帖子（只有 insert 与 public read 策略，update/delete 默认拒绝）
drop policy if exists "posts own update" on posts;
drop policy if exists "posts own delete" on posts;

-- 公开只读已审核帖子（保持）
drop policy if exists "posts public read" on posts;
create policy "posts public read" on posts
  for select
  using (status = 'approved');
