# 吉政知行 v0.6.3

在 v0.6.2 基础上加入图片及文档理解。前端 PWA + Cloudflare Worker，后端无额外运行依赖。

## 模型
- 纯文本：Cloudflare Workers AI `@cf/zai-org/glm-4.7-flash`（沿用原有 AI 绑定）。
- 有图片/文件：DeepSeek V4.1 Flash，API 名为 `deepseek-flash`，使用 DeepSeek `/files` + `/chat/completions`。

## 测试

```bash
npm install
npm test
```

本地自动测试不需要真实 DeepSeek 密钥。完整手机交互测试文件位于 `tests/browser_attachments.py`，需具备 Python Playwright 和 Chromium 的测试环境。

## 上线准备（当前未部署）

1. 将 v0.6.3 工程代码合并至现有 GitHub 项目。
2. 在 Cloudflare Workers → `jizhengzhixing` → Settings → Variables and Secrets 新建 **Secret**：`DEEPSEEK_API_KEY`，填入自己的 DeepSeek API Key。**不要把密钥提交到仓库、放入前端 JS、发送到聊天中。**
3. 确认原有 Workers AI 绑定 `AI`、限流绑定 `LIMITER` 正常。
4. **在开放付费附件接口前，限制访问范围**：优先用 Cloudflare Access 允许三名队员和评委的指定账号访问；如果要公众开放，先补充真实登录和服务端配额控制。仅有浏览器 Origin 校验和 IP 限流，不构成用户鉴权。
5. 再部署，实际测试一张非敏感公开办事截图和一份公开政策 PDF。检查 DeepSeek 账单与 Cloudflare 日志。

API Key 没有配置时，文字 AI 仍可运行；附件请求会返回明确的错误 `NO_DEEPSEEK`，**不会生成伪造的文件分析结果**。

## 资源与成本

- v0.6.3 仅支持 ≤8 MiB 的附件；v0.6.4 新增分块大文件通道，按文件类型限制大小。
- DeepSeek 图片识别按输入 token 计费；PDF/Word/PPT 解析可能产生按页费用，上传后对话还有 token 费用。具体以其当期官方定价为准。
- DeepSeek 文件保留期设置 1 小时，上游文件存储不归 Cloudflare 管理。不要上传未经脱敏的个人材料。
- 文件上传解析可能明显慢于纯文本，不等于 UI 卡死。请求等待上限为 180 秒，错误会明确返回。

工程详细变更见 `docs/CHANGELOG_v0.6.3.md`。

## v0.6.4：大文件与三人协作

- 附件限制按文件类型处理：PDF/Word/PPT 100 MB、图片 64 MiB、表格和文本 32 MiB。小文件直传，大文件 8 MiB 分块进入私有 R2 后流式转交 DeepSeek。
- 大文件功能需要 **R2 bucket `jzzx-uploads`**、Worker 绑定 `UPLOADS` 以及服务端密钥 `UPLOAD_SIGNING_KEY`，见 [`docs/CHANGELOG_v0.6.4.md`](docs/CHANGELOG_v0.6.4.md)。在线使用前还须限制付费 API 的访问范围。
- 三人 GitHub 分工、分支、PR 约定见 [`docs/TEAM_GITHUB.md`](docs/TEAM_GITHUB.md)。
- 目前未改动既有 Cloudflare 线上应用，也没有进行真实 100 MB 上传验证。
