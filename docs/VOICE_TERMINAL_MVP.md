# 吉政知行 · 吉小知 ESP32-C3 语音终端

状态：第一阶段云端语音回合网关已加入功能分支；ESP32 固件尚未完成实机编译和联调。不得将本文件中的目标描述为已验收功能。

## 1. 产品行为

设备采用自然连续对话的半双工轮次模式：

1. ESP32-C3 持续采集 I2S 麦克风音频并做本地 VAD。
2. 检测到用户说话后，收集一个完整语音片段；检测到静音后结束本轮。
3. 设备通过 HTTPS 将 WAV 音频提交到 Worker 的 `POST /api/voice/turn`。
4. Worker 使用多语言 Whisper 转写，再调用现有 `POST /api/chat` 对话处理链（`mode=agent`）。
5. Worker 使用中文 TTS 合成 WAV，返回短时音频 URL。
6. 设备下载并通过 MAX98357A 播放回答，播放期间暂停麦克风采集；播放结束后自动恢复聆听。

v1 不实现打断播报（barge-in）和声学回声消除。这样可避免扬声器声音被麦克风再次识别为用户输入。当前对话上下文由设备在 RAM 中保留最近四轮；不将完整对话写入设备闪存。

## 2. 已确认硬件

- 主控：ESP32-C3 Super Mini（依据用户提供的板卡引脚图）
- 麦克风：I2S 模块，丝印为 L/R、WS、SCK、SD、VDD、GND；型号待核实，外观符合 INMP441 类模块
- 功放：MAX98357A I2S Amp（模块丝印已确认）
- 扬声器：接 MAX98357A 绿色螺丝端子

## 3. GPIO 分配

| ESP32-C3 Super Mini | 连接到 | 说明 |
|---|---|---|
| GPIO4 | 麦克风 SCK + MAX98357A BCLK | 共用 I2S 位时钟 |
| GPIO5 | 麦克风 WS + MAX98357A LRC | 共用 I2S 字选择时钟 |
| GPIO6 | 麦克风 SD | I2S RX 数据 |
| GPIO7 | MAX98357A DIN | I2S TX 数据 |
| 3V3 | 麦克风 VDD | 麦克风使用 3.3 V |
| 5V | MAX98357A VIN | 功放供电；确认 USB 供电能力 |
| GND | 麦克风 GND、功放 GND | 必须共地 |
| GND | 麦克风 L/R | 选择左声道 |

扬声器两根线接 MAX98357A 的两个扬声器输出端。不得将任一扬声器输出端接 GND。功放 SD 可由固件 GPIO 控制或按模块设计上拉；首版先确认模块 SD 默认状态，不能悬空假设。

GPIO4/5/6/7 是本项目为该开发板选定的配置，不是 ESP32-C3 所有板卡的通用默认值。不要将 5 V 接到 ESP32 GPIO 或麦克风 VDD。

## 4. I2S 配置约束

ESP32-C3 有一个 I2S 外设，但 ESP-IDF 标准 I2S 驱动提供独立 TX/RX channel；STD 全双工模式可共享 BCLK/WS，分别使用 DIN/DOUT。麦克风和功放因此可以共享 GPIO4/GPIO5 时钟。

推荐先用 16 kHz、32-bit stereo slot 运行 I2S；INMP441 类麦克风的有效数据通常为 24-bit，软件提取左声道并转换为 16-bit PCM。MAX98357A 从 TX 数据线接收 PCM。必须在逻辑分析仪/串口采样测试中验证声道、对齐和幅度后再确定最终格式。

ESP-IDF 官方说明：
- https://docs.espressif.com/projects/esp-idf/en/latest/esp32c3/api-reference/peripherals/i2s.html

## 5. 云端接口

### 请求

`POST /api/voice/turn`

Headers:
- `Authorization: Bearer <VOICE_DEVICE_TOKEN>`
- `Content-Type: multipart/form-data`

Fields:
- `audio`: WAV 文件（当前 Worker 上限 1 MiB）
- `region`: 如 `长春市`
- `history`: JSON 数组，最多四轮，元素为 `{role, content}`

### 成功响应

```json
{
  "transcript": "吉林省大学生创业有哪些补贴？",
  "reply": "吉小知的文本回答",
  "audioUrl": "https://...",
  "audioFormat": "wav",
  "sampleRate": 16000,
  "voice": "ara",
  "region": "长春市",
  "actions": [],
  "sources": []
}
```

音频 URL 由 TTS 服务提供，设备应立即下载，不应长期保存 URL。Worker 不向设备暴露模型供应商密钥。

### 模型

- ASR：`@cf/openai/whisper`，多语言识别。
- 对话：复用当前 `src/worker.mjs` 的 `/api/chat` 与 `src/agent.mjs`，不另建吉小知人格或业务提示词。
- TTS：`xai/grok-tts`，语言 `zh`，声音 `ara`，请求 WAV/16 kHz。

模型参考：
- https://developers.cloudflare.com/workers-ai/models/whisper/
- https://developers.cloudflare.com/ai/models/xai/grok-tts/

## 6. Worker 配置

部署前需在 Cloudflare Worker 添加 Secret：

```bash
openssl rand -hex 32
npx wrangler secret put VOICE_DEVICE_TOKEN
```

将生成的同一个设备 token 配置进固件本地配置；不要提交到 Git。若 token 泄露，应轮换 Worker Secret 并重新烧录设备。

现有 `AI` binding 已由 `wrangler.jsonc` 声明。当前功能分支未部署线上 Worker。

## 7. 开发与验证工具

- 固件：ESP-IDF 5.5.x（VS Code ESP-IDF Extension、CMake、Ninja、`idf.py`）
- 云端：Cloudflare Workers、Workers AI、Wrangler
- 测试：Node.js 内置 `node:test`
- 版本管理：GitHub feature branch

## 8. 当前实现状态

- [x] 确认 ESP32-C3 Super Mini 引脚图
- [x] 确认 MAX98357A 模块
- [x] 选定 I2S GPIO 映射
- [x] 新增 Worker 语音回合处理模块 `src/voice.mjs`
- [x] 接入 `/api/voice/turn` 路由
- [x] 新增 ASR → 吉小知 chat → TTS 接口单元测试
- [ ] 运行 Node 测试套件
- [ ] 新增并编译 ESP-IDF 固件
- [ ] 配置 Worker Secret
- [ ] 部署语音接口
- [ ] 实机采集、识别、播报和连续对话联调
- [ ] 30 分钟稳定性测试

任何未完成项不得标记为已验收。
