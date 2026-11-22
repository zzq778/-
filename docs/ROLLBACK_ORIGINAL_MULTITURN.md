# 恢复原始多轮对话版本

## 回退基线

- 原始聊天实现取自仓库历史提交 `a2cb33bad829`（2026-11-14，v0.6.4 导入版）。
- v0.6.1 的变更记录仅涉及首页头图拼接；v0.6.2 明确保留完整 AI 问答。v0.6.4 中完整保留该聊天实现。
- 本分支将原始 PWA 源文件固定复制到 `mobile/original-site/`，Android 构建只做资源内嵌，不重写原始聊天逻辑。

## 必须保持的原始交互

- `ai-full-panel` 完整对话面板。
- `state.messages` 作为唯一消息列表。
- `chat-stream` 按消息顺序呈现用户与助手消息。
- `chat-form` 负责持续发送消息。
- 每次请求携带最近四条非错误消息，接口为 `POST /api/chat`。
- 保留原版思考状态、逐字呈现、语音入口、播报和附件入口。
- 不使用旅行版 `/api/travel`、`chatMessages`、`previousIntent` 或 1.0.4 新增的行程对话状态机。

## 后端

Cloudflare Worker `jizhengzhixing` 仍有已部署版本，最新部署时间为 2026-11-14T07:38:47Z，版本绑定为 `AI`、`ASSETS`、`LIMITER`。Android WebView 使用该 Worker 的 HTTPS origin 作为 base URL，因此原始页面的 `/api/chat` 和 `/api/status` 请求保持同源。

旅行预览 Worker `jizhengzhixing-mobile` 不做修改。APK 不再调用其 `/api/travel` 接口。

## Android 构建

- APK 版本：`0.6.4-original-chat`，versionCode 18。
- `bundle_original.py` 只内嵌原版 CSS、JavaScript 和图片资源，并对多轮对话关键标记做构建期断言。
- Android WebView 通过原始 Worker origin 加载本地打包页面；麦克风权限和系统语音识别通过 Android 原生桥接。
- 预览 APK 使用临时签名密钥；若覆盖安装时提示签名不一致，需先卸载旧预览版。卸载会清除本地偏好。

## Git 记录

- 1.0.4 恢复尝试 PR #18 已按用户要求关闭，未合并。
- 本回退在独立分支中提交，不直接改写 main 历史。
