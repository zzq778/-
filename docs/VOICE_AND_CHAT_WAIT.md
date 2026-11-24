# 语音输入与多轮对话

## Android 语音输入

- Android WebView 通过 `JZZXNativeVoice` 调用原生 MediaRecorder。
- 录音编码为 AAC / MPEG-4，16 kHz、单声道、64 kbps，最长约 15 秒。
- 再次点击麦克风结束录音，音频以 `audio/mp4` 上传至 `POST /api/v1/transcribe`。
- 移动 Worker 调用 `@cf/openai/whisper-large-v3-turbo`，使用中文语言参数和吉林地名提示词。
- 识别文本写回当前输入框，用户可以修改后手动发送；不会自动发送。
- 浏览器非 Android WebView 环境使用 SpeechRecognition / Web Speech API fallback。系统语音识别提供方和语言包由浏览器决定。

## 多轮对话

- 聊天请求使用 `POST /api/v1/chat`，历史消息由客户端按 user / assistant 顺序传入。
- 普通追问保留上下文，不重复进入无关工具选择循环；涉及景点时先使用本地景点目录核对并返回来源。
- 预览 Worker 使用 `@cf/meta/llama-3.3-70b-instruct-fp8-fast`；公开预览配置每 IP 10 次 / 分钟限流。
- 预览接口免访问码不代表生产接口免访问码。正式 `jizhengzhixing-mobile` Worker 仍保留原访问控制，本次不部署它。

## 等待与验证边界

- 等待指示跟随实际请求状态；成功、失败或取消后结束，并支持 prefers-reduced-motion。
- 自动化测试覆盖多轮历史传递、工具结果、语音转写接口和 UI 状态；PR #21 的真实预览验证完成三轮对话及 APK 构建。
- 自动化模拟不等同真实麦克风测试；识别准确率、权限弹窗和不同 Android 机型仍需实机验收。
