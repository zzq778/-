# 吉小知 ESP32-C3 语音配件 · 测试进展

记录日期：2026-11-21

## 已完成的代码与自动化验证
- GitHub PR #17：独立语音网关、ESP32-C3 ESP-IDF 工程、部署/调试说明。
- Node 回归：鉴权、长度边界、音频转WAV、WAV到PCM重采样、模拟STT→现有文旅规划→模拟TTS链路，通过 GitHub Actions gateway-test。
- ESP-IDF v5.3.6，目标 esp32c3，编译成功（一次验证的固件大小约0x101390字节，2MB应用分区剩余约50%）。
- 编译期间发现 SPIFFS 头文件错误，已按真实编译日志修复；之后已取得一轮成功构建。

## 验收边界
- Node 集成测试使用模拟模型回复，不能证明实际Cloudflare模型配额、MiniMax模型访问、中文音色与远程WAV输出格式已通过真实网络调用。
- GitHub Actions构建使用 secrets.h.example 中占位Wi-Fi与设备凭证，不是可直接联网的最终固件。
- 当前没有硬件，不能验证INMP441真实录音、MAX98357A播放、电池电压、电源噪声及无线性能。
- 独立Worker尚未进行Cloudflare生产部署；必须先确认账户的MiniMax付费模型权限、设置VOICE_DEVICE_CODE。
- 现有Cloudflare网站Worker的独立构建检查失败不表示语音网关单元测试失败；它不在本次变更范围。

## 后续实测记录字段
- 具体开发板型号/Flash容量：
- 真实ESP-IDF编译版本与SHA：
- 麦克风PCM采样幅值：
- HTTPS上传响应码：
- 中文ASR转写内容与耗时：
- 规划回答与耗时：
- TTS输出采样率、长度与耗时：
- 功放输出/供电测试：
- 电池续航和断电行为：
