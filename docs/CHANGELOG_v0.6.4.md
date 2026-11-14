# v0.6.4｜100 MB 大文件通道与团队协作

## 上传范围

- PDF、DOC、DOCX、PPT、PPTX：最高 **100 MB（十进制）**。
- JPG/JPEG/PNG/WebP/GIF：最高 **64 MiB**。
- XLS/XLSX、TXT/MD/CSV：最高 **32 MiB**。
- ≤8 MiB 的文件继续走原有小文件直传；更大的文件走分块上传。
- 这些是 DeepSeek Files API 文件类型的官方限制与 Cloudflare 传输条件下的可执行上限，不保证 100 MB 文件在弱网中一定成功解析。

## 技术流程

前端 8 MiB 分块 → `/api/upload/start`（服务端创建 R2 multipart）→ `/api/upload/part`（每块 <=8 MiB）→ `/api/upload/complete`（R2 合并）→ `/api/chat`（提交签名 ticket）→ Worker 流式上传至 DeepSeek `/files` → DeepSeek Chat → 返回答复 → 删除 R2 临时文件。

分块 ticket 使用 `UPLOAD_SIGNING_KEY` 做 HMAC 签名，2 小时过期。上传时限制类型、大小和分块长度，已接入原有 `/api/chat` 与 IP 限流。未配 `UPLOADS` / 密钥时大文件返回配置错误，小文件与纯文字不受影响。失败中途会尝试中止 R2 multipart。

## 云端配置（未自动执行）

1. Cloudflare → R2 创建**私有** bucket：`jzzx-uploads`，选择 Standard 存储类型。
2. 在 Worker `jizhengzhixing` 配置 R2 binding：变量 `UPLOADS`，绑定上述 bucket；工程 `wrangler.jsonc` 已声明，GitHub 自动部署时需要先确保桶存在。
3. Worker Secrets 新建 `UPLOAD_SIGNING_KEY`，值使用本地随机生成的 **至少 24 字符**私密字符串；继续使用原有 `DEEPSEEK_API_KEY`，两者都不要提交到 GitHub。
4. 设定 R2 临时对象 `temp/` 的生命周期删除规则（建议 1 天）；未完成的 multipart upload 也应及时中止 / 设置后台自动清理。
5. **先限制访问再启用付费文件解析**：当前应用没有真实账号鉴权。建议测试期间通过 Cloudflare Access 限定团队和评委身份；Origin 检查与 IP 限流不足以保护付费接口。
6. 再部署工程，分别用公开非敏感 PDF 10 MiB、60 MiB 和接近 100 MB 的文档实测上传、耗时、失败处理与 R2 清理，并核对账单。

## 现状

- 本地 Node.js 测试：30 项通过。
- 云端 R2 大文件上传与 DeepSeek 大文件解析：**尚未实测**，不能声称正式上线已经可用。
- 手机端仅做源码校验；新进度 UI 的实际真机体验仍需后续验收。
- 原 v0.6.3 ≤8 MiB 直传路径保留。
