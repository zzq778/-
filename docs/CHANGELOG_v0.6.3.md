# 吉政知行 v0.6.3｜图片与文件理解

## 范围
在 v0.6.2 上增加多模态附件输入，不改首页、光球及现有的纯文字模型。未部署到 GitHub / Cloudflare。

### 用户功能
- AI 完整对话输入栏新增“＋”按钮，可选择一张图片或一个文件。
- 已选附件展示文件名和大小，可取消；文字问题可选。
- 支持 PNG/JPG/WebP/GIF、PDF、DOC/DOCX、PPT/PPTX、XLS/XLSX、TXT/MD/CSV。
- 单文件限 8 MB。待识别文件随请求上传，不保存到 Cloudflare Worker；成功后仅在本轮回答中使用。
- 政务问答保留站内操作/可信外链白名单；可根据识图结果补充合适的已审核事项入口。

### 后端
- JSON 请求继续走 Cloudflare Workers AI：`@cf/zai-org/glm-4.7-flash`。
- `multipart/form-data` 请求走 DeepSeek Files API（图片使用 `user_data`，文档按格式选 `text_recognition` 或 `user_data`），随后调用 `deepseek-flash`（显式关闭默认思考模式，避免输出限制被推理内容耗尽）。
- 文件按 DeepSeek 最短支持的 `expires_after=3600 seconds` 保存于上游（不等于 Worker 保存）。
- API Key 从 Cloudflare Worker 的 secret `DEEPSEEK_API_KEY` 读取，绝不放入网页或 Git 仓库。
- 严格限制单附件 8 MB、支持格式、跨来源、请求频率；用户上传内容视为不可信数据。
- 调整请求等待上限：文件解析最长允许 180 秒，普通文字保持 20 秒。
- 修复继承自 v0.6.2 的 `reduced()` 未定义错误，避免回答动画进入异常状态。
- 补齐此前缺失的两种 PWA 安装图标，避免 Service Worker 预缓存因 404 中断。

### 已验证
- 24 项 Node 自动测试通过，其中 7 项覆盖文件接口协议、文件类型、尺寸、未配置和服务失败。
- Chromium 320/390/430px 宽度测试：选择附件、显示文件、移除、multipart 请求及回复 UI 通过。
- **未进行 DeepSeek 真实 API 在线调用**：因为本地没有用户的密钥，也未执行生产部署。

### 发布前限制
- 当前公开端点没有真实用户鉴权；仅凭 Origin 和 IP 限流不足以保护一个付费 API。上线前应通过 Cloudflare Access 限制演示访问，或先实现账号登录与服务端配额。否则可能被滥用产生费用。
- 不要上传真实身份证、社保账号、病历、含个人敏感信息的文档。测试使用脱敏资料。
- 文件仅在提交时上传至 DeepSeek，不会上传到我们自有对象存储；文件提供商仍会按上述有效期保留文件。
- 政策分析仅作辅助，具体条件以官方原文/办理渠道为准。不能冒充政府官方系统。
