## 描述变更

<!-- 这个 PR 解决了什么问题？如果与 Issue 相关，请用 "Closes #123" 关联 -->

Closes #

## 变更类型

- [ ] 🐛 Bug 修复
- [ ] ✨ 新功能
- [ ] 📊 新增 / 调整数据源
- [ ] 📝 文档
- [ ] ♻️ 重构（无行为变化）
- [ ] ⚡ 性能优化
- [ ] 🧪 测试
- [ ] 🔧 其他（请说明）：

## 测试验证

请勾选已完成的验证项（交付前必须通过）：

- [ ] `npm run build` 通过（Next.js 构建零错误）
- [ ] `npm run lint` 通过（如涉及前端）
- [ ] `python -m unittest discover tests` 通过（如涉及 worker）
- [ ] `python cli.py stats` 确认数据条数符合预期（如涉及数据源）
- [ ] `python cli.py crawl --dry` 试跑通过（如新增数据源）

## 数据源变更（如有）

- 新增 / 修改的数据源：`apps/worker/app/sources/xxx.py`
- 数据来源与合规确认：
  - [ ] 遵守目标站点 robots.txt
  - [ ] 设置了合理请求频率（REQUEST_DELAY）
  - [ ] 使用独立 UA
  - [ ] 数据标注来源，跳转官方入口，不截留简历

## UI 变更（如有）

- [ ] 已附截图（移动端优先）
- [ ] 移动端 / 桌面端（992px 断点）均已检查

## 数据库变更（如有）

- [ ] 在 `infra/supabase/migrations/` 新增迁移文件（未修改已应用迁移）
- [ ] RLS 策略符合既有约定（用户私有表仅本人可见）

## Checklist

- [ ] 我的 Commit 信息符合规范：`[YYYY-MM-DD HH:mm] type: 描述`
- [ ] 我已阅读 [CONTRIBUTING.md](../blob/main/CONTRIBUTING.md) 并遵守合规红线
- [ ] 代码可读、注释到位、无调试残留
- [ ] 无密钥 / 敏感信息提交（检查 `.env`、`*.local` 是否误入库）

## 补充说明

<!-- 任何需要维护者注意的额外信息 -->
