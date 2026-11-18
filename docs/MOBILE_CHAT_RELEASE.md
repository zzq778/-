# 移动端对话上线修复

Android 或 Windows 出现「当前服务不支持对话」时，先检查移动 Worker 是否已提供 /api/v1/chat，不能通过重装解决旧云端接口。更新目标是现有 jizhengzhixing-mobile，保留原 TRAVEL_PREVIEW_CODE，不影响另一个 Web Worker，不创建数据库、不启用额外付费服务。

## 本地部署（已有合法 Cloudflare 登录）
在 feat/agent-native-product 分支执行：
```sh
npm run build:mobile
npm test
npx wrangler deploy --config wrangler.mobile.jsonc --keep-vars
node scripts/check-mobile-service.mjs
```
已有 GitHub 仓库凭证 CLOUDFLARE_API_TOKEN 时，Mobile service release 工作流可部署；没有凭证时不会部署。应使用最小权限、仅目标账户的 Worker 编辑权限；不把密钥写入文件或聊天。可用既有 TRAVEL_PREVIEW_CODE 环境变量执行单次模型真实测试，否则只验证接口及服务就绪状态。

线上部署成功后旧的 1.0.0-preview APK 已有对话入口，无需重装。D1、外部检索、图片仍是独立配置，不随该修复自动启用。
