# 安全策略（Security Policy）

**Offer派（OfferPai）** 重视安全问题。本项目为公益性质、不盈利，维护力量有限，但我们会认真对待每一条安全反馈。

## 支持范围

| 版本 | 支持状态 |
|---|---|
| `main` 分支（当前活跃开发） | ✅ 支持 |
| 历史 Release | ❌ 不提供（暂无正式 Release） |

## 上报漏洞

**请勿将安全漏洞以公开 Issue 的形式提交。** 公开披露可能让漏洞在被修复前被利用。

上报渠道（任选其一）：

1. **GitHub Security Advisory（推荐）**：在仓库页面选择 `Security → Report a vulnerability`，填写漏洞描述。
2. **私信维护者**：通过 GitHub 联系 [@Oo0520](https://github.com/Oo0520)。

请提供：

- 漏洞类型与影响范围
- 复现步骤（最小化、可复现）
- 受影响的版本 / 分支 / 页面或接口
- 如果可行，附上缓解建议

## 响应预期

| 反馈类型 | 预期时间 |
|---|---|
| 确认收到 | 72 小时内 |
| 严重性评估与修复计划 | 1 周内 |
| 修复发布 | 视复杂度而定，尽力而为 |

> 公益项目无 SLA 承诺，以上为尽力目标。紧急高危问题建议同时通过维护者 GitHub 私信提醒。

## 项目已有的安全实践

- **数据库访问**：Supabase RLS 按行级权限隔离——岗位/公司公开可读，用户私有表（`saved_jobs`、`applications`、`profiles` 等）仅本人可见。
- **密钥管理**：`SUPABASE_SERVICE_KEY`、`DATABASE_URL` 等敏感凭据只存在于 `.env` / `.env.local`，**从不入库**（`.gitignore` 已排除）。
- **接口限流**：前端 API 60 次/分钟/IP（`apps/web/lib/ratelimit.ts`）；MCP 服务 120 次/60 秒。
- **隐私保护**：产品定位不截留简历、不收集个人隐私数据；爬虫只采集公开岗位信息。
- **爬虫合规**：遵守 `robots.txt`、请求限速、独立 UA。

## 已知限制

- 前端 API 使用 service key 直连 Supabase（当前架构限制），请确保该密钥**仅限服务端使用**，不要暴露在客户端 bundle 中。
- 内网穿透地址（Cloudflare Tunnel）为临时测试用途，正式上线前请切换为受控部署。

## 修复流程

1. 维护者确认漏洞并在私有分支修复。
2. 在本地完成回归验证（`npm run build` + worker 单元测试）。
3. 通过常规 commit（格式 `[YYYY-MM-DD HH:mm] fix: ...`）合入 `main`。
4. 确认修复后更新本文件或发布安全说明。
