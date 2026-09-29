-- company_type 独立维度（公司性质，2026-09-29）
-- 背景：源数据把"外企/合资"当行业写入，前端筛选混乱。拆为独立 company_type 列。
-- 迁移已手工执行；此文件保留 schema 变更记录，供新环境重建。
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_type text;

-- 存量迁移：industry='外企/合资' -> company_type='外企/合资'，industry 置空
UPDATE jobs SET company_type = '外企/合资', industry = NULL WHERE industry = '外企/合资';
