# 移动端 1.0.6 对话与语音版本

## 集成内容

- Android / WebView 使用新版移动端页面。
- 多轮对话通过 `/api/v1/chat`，历史消息由客户端传入。
- 云端语音输入通过 Android MediaRecorder 录制 AAC，再由移动 Worker 的 Whisper large-v3-turbo 转写。
- 预览模型使用 `@cf/meta/llama-3.3-70b-instruct-fp8-fast`。
- 对话与语音接口由独立移动 Worker 提供，不改动根站 Worker 的路由实现。

## 当前服务边界

- App 当前连接 `jizhengzhixing-mobile-preview.zedi-li070614.workers.dev`。
- 该预览 Worker 配置 `PUBLIC_CHAT=true`，没有访问码；保留来源检查、请求体限制和每 IP 10 次 / 分钟限流。
- 公开调用可能消耗 Workers AI 配额。它是预览服务，不应当视为正式生产服务。
- 本次合入不执行 Cloudflare Worker 部署，不修改正式 `jizhengzhixing-mobile` Worker。正式 Worker 原有访问控制保持不变。
- 不修改 `website/` 官网目录；官网开局介绍页继续由原 Pages 项目发布。

## 验证

- GitHub Actions 运行 `npm run build:mobile`、`npm test` 和移动端浏览器回归。
- Android APK 单独构建并检查签名。
- PR #21 的隔离预览验证已完成三轮真实模型对话与 APK 构建。
- 真机麦克风录音、嘈杂环境识别准确率仍需在实体 Android 设备上验收。

## 后续正式发布条件

正式发布前应单独决定是否开放免访问码服务、生产限流额度及 Workers AI 预算，再使用 `wrangler.mobile.jsonc` 部署正式移动 Worker。不要把预览 Worker 的公开配置直接复制到生产配置。
