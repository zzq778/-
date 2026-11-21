# 吉政知行 · ESP32-C3 吉小知语音配件

## 第一版范围
点击按键 → 录音3秒 → ESP32-C3通过2.4GHz Wi-Fi上传16kHz单声道PCM → 云端中文语音识别 → 吉政知行已有文旅规划智能体 → 中文TTS → 云端转码16kHz PCM → ESP32-C3扬声器播报。

不需要屏幕、MP3解码器、PSRAM、树莓派或本地大模型。当前仅用于吉林文旅语音咨询和行程规划，不涉及实时导航、支付或代办政务。没有连续语音唤醒和全双工。

## 建议接线（需结合你的具体开发板实物确认）
| ESP32-C3引脚 | 连接元件 | 功能 |
| --- | --- | --- |
| GPIO4 | INMP441 SCK + MAX98357A BCLK | I²S BCLK共用 |
| GPIO5 | INMP441 WS + MAX98357A LRC | I²S WS共用 |
| GPIO6 | INMP441 SD | 麦克风输入 |
| GPIO7 | MAX98357A DIN | 功放输出 |
| GPIO3 | 按键到GND | 低电平触发、内部上拉 |
| 3.3V | INMP441 VDD | 注意：INMP441绝不能接5V |
| GND | INMP441 GND与功放GND | 全系统共地 |
| GND | INMP441 L/R | 固定左声道 |
| 5V | MAX98357A VIN | 稳定5V电源 |
| 功放SPK+/SPK- | 4Ω、3W扬声器 | SPK-不能接GND |

ESP32-C3开发板用USB供电，或核对板卡引脚后用稳定5V供电，严禁把5V接入3.3V脚。用户现有的12V输出不需要使用。

## 软件位置
- 云端语音网关：src/device-voice.mjs
- Cloudflare入口：src/device-worker.mjs
- 独立部署：wrangler.device.jsonc，Worker名jizhengzhixing-voice，独立于现有网页和移动端
- 音频协议：POST /api/device/talk，请求体PCM s16le 16000Hz mono，长度1至5秒；返回同格式PCM
- 文本调试：POST /api/device/ask，请求JSON {"question":"吉林市两日游"}，返回JSON问题及答案
- 状态：GET /health，返回ready与版本，不公开密钥
- 固件项目：device/esp32c3/，ESP-IDF 5.3.x
- 自动化测试：tests/device_voice.test.mjs
- 云端测试脚本：scripts/device-voice-smoke.mjs

## 云端处理与费用
1. Cloudflare Workers AI Whisper large-v3-turbo 将WAV转录为中文。
2. 复用已有wenlv/travel-agent.mjs及GLM-4.7-Flash行程规划。
3. 第三方MiniMax Speech 2.6 Turbo合成中文WAV，默认音色Chinese (Mandarin)_Warm_Girl。
4. Worker解析WAV、重采样为16000Hz PCM并返回ESP32-C3。
5. 独立秘密配置VOICE_DEVICE_CODE，长度至少32字符；只给本设备Bearer访问，不给任何Cloudflare管理员密钥。
6. 已有LIMITER实例限制每60秒最多3次请求。网关限制输入音频5秒，输出音频30秒。不会在云端写入录音。

**关键前提：** 需要Cloudflare账户授权上述模型，特别是MiniMax第三方TTS可能计费。代码和CI测试不会触发真实模型账单。真人发音、实际生成WAV格式、全链路网络延迟仍需在云端实际启用后验证。

## 云端部署与无硬件验证
1. 在已连接账户确认Workers AI可用及MiniMax费用，Node.js环境中运行npm install。
2. 运行：npx wrangler deploy --config wrangler.device.jsonc
3. 生成随机32字符以上设备访问码，运行：npx wrangler secret put VOICE_DEVICE_CODE --config wrangler.device.jsonc
   在安全提示中粘贴访问码；不要提交到GitHub。
4. 本机设环境变量JZZX_VOICE_URL（独立Worker HTTPS域名，不能是已有网页Worker）和JZZX_VOICE_CODE（同一访问码）。
5. 执行：node scripts/device-voice-smoke.mjs。会先检测/health，再通过/api/device/ask验证文本智能体。
6. 有真人录音时用ffmpeg转换：ffmpeg -i question.wav -ac 1 -ar 16000 -f s16le -acodec pcm_s16le question.pcm
7. 执行：node scripts/device-voice-smoke.mjs question.pcm answer.pcm
8. 电脑试听：ffplay -f s16le -ar 16000 -ac 1 answer.pcm

真实模型调用和部署可能收费；测试前请先确认服务额度。当前没有代表用户执行云端部署或实际付费推理。

## ESP-IDF固件
1. 需要ESP-IDF 5.3.x、4MB或以上Flash的ESP32-C3开发板。
2. 进入device/esp32c3目录，复制main/secrets.h.example为main/secrets.h，填写Wi-Fi、Worker域名及独立设备码。
3. idf.py set-target esp32c3
4. idf.py build
5. 实板连接后：idf.py -p COM端口 flash monitor
6. GPIO3按钮按下后采集3秒，SPIFFS存入request.pcm，再通过HTTPS流式上传；播放时设备只持有小块I²S缓冲，不保存全部TTS音频。
7. main/secrets.h被.gitignore忽略，不能包含真实密码提交。

录音会临时留在本地SPIFFS中直到下一次录音覆盖。若用于实际游客，请增加必要隐私告知与本地数据擦除机制；第一版不应录制敏感资料。

## 验证清单
- 已支持无硬件：Node.js协议/鉴权/采样率/WAV/模拟模型集成自动化测试；GitHub Actions编译检查。
- 有Cloudflare访问权限可验证：独立Worker部署；真实ASR/规划/TTS/音色和网络延迟。
- 硬件到手后才可验证：麦克风电平、I²S驱动、功放音质、Wi-Fi供电稳定性、续航及外壳散热。
