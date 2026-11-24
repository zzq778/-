# Android 1.0.6 真机验收与导出

- 当前预览版本：`1.0.6-no-code-preview`，versionCode 23。
- WebView 加载本地打包 HTML；第三方链接交由系统浏览器。
- 原生接口包含用户主动触发的文件保存、中文 TextToSpeech 和麦克风录音；不开放任意文件读取或设备凭证访问。
- Android 语音输入使用 MediaRecorder 录制 AAC / MPEG-4，16 kHz、单声道、64 kbps；最长录音约 15 秒。音频以 `audio/mp4` 上传到移动 Worker 的 `/api/v1/transcribe`，由 Workers AI Whisper large-v3-turbo 转写。
- 语音识别结果填入聊天输入框，用户检查后自行发送；不自动提交。
- 浏览器环境保留 SpeechRecognition / Web Speech fallback。Android WebView 优先走原生录音桥接。
- 朗读使用 Android TextToSpeech 简体中文语种；语音包不可用时提示用户。
- GitHub Actions 已验证 APK 构建和签名格式；自动化测试使用模拟录音回调。真实手机麦克风权限弹窗、录音质量、嘈杂环境识别率、TTS 播放及文件保存仍需真机验收。
- 默认构建使用临时预览签名，不能保证覆盖安装不同签名的 APK。稳定签名密钥通过 `ANDROID_PREVIEW_KEYSTORE_B64` 等环境变量配置，不得提交到仓库。正式发布签名和生产发布需另行授权。
