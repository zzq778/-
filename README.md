# 吉政知行 · AI 接入版 v0.5

**状态：可部署的完整前后端工程；本地模拟测试通过，尚未用 Cloudflare 账号部署并验证真实 AI 推理。**

这版沿用 v0.4 界面与动效，替换本地关键字假回答为**真实云端模型 API**：`/api/chat` 调用 Cloudflare Workers AI。前端与后端部署在**同一个域名**，无需单独购买服务器，也不需要用户本地运行模型。

## 1. 两分钟看懂架构

```text
手机 PWA / 电脑浏览器
   ├── 首页 / 地区 / 政务入口 / AI 悬浮胶囊  （public/）
   └── POST /api/chat
         ├── 接受用户问题与地区
         ├── 从已核对的官方入口级知识中查找相关事项（src/knowledge.mjs）
         ├── 用系统提示约束政策幻觉
         ├── 调用 Cloudflare Workers AI 真实模型（src/worker.mjs）
         └── 返回 { text, actions, sources }，前端渲染并支持站内跳转
```

- 模型：`@cf/zai-org/glm-4.7-flash`（官方模型目录可查，使用 `env.AI` 绑定，不需要另外保存模型 API Key）。
- 静态页面：Cloudflare Workers Static Assets；与 API 同源，避免跨域配置和额外网站。
- 服务端默认以 IP 做**近似限流 8 次/分钟**。正式公开应用前仍需完善账号、总量预算和隐私策略。
- 不使用 LXClaw；这与比赛平台要求可能冲突，须由队伍向组委会核实，不代表本工程已经被确认符合赛事资格。

## 2. 免费部署（需要一个 Cloudflare 账号）

前提：Windows/macOS/Linux 开发机安装 Node.js 20+；Cloudflare 账号可用且 Workers AI 已开通。**不需要购买 VPS**。

1. 解压整个 ZIP，**不要只上传单文件 HTML 到 GitHub Pages**。
2. 在项目根目录打开终端，执行：

   ```bash
   npm install
   npx wrangler login
   npm run deploy
   ```

3. 命令返回 `https://jizhengzhixing.<你的 Workers 子域>.workers.dev` 一类的 HTTPS 地址，打开即可。
4. 浏览器访问 `https://实际域名/api/status`，预期有 `"ready":true`（仅代表 AI 绑定存在，不代表模型推理一定可用）。
5. 打开主界面 → 吉小知 → 完整对话 → 输入“医保报销怎么查”。成功时会显示模型文字、应用内指南按钮、政务官方入口。
6. 如需自有域名，在 Cloudflare 的 Worker 设置中添加自定义域名（域名必须适配你的 Cloudflare DNS 配置），不是必需。

说明：Cloudflare 免费计划具有每日推理额度，超出额度后会报错；这里没有假定免费无限量，也没有自动充值。国内网络可达性须在实际使用地测试。

## 3. 运行与数据边界

- **真实 AI**：需要部署完成、Workers AI 绑定可用、网络通畅；本地 `content://downloads` 或 `file://` 打开只会显示明确错误，不会伪造 AI 回答。
- **知识库 v0.5**：仅为六类政务事项的官方入口级检索，不是最新政策全文 RAG。`src/knowledge.mjs` 写明了已知路径和可点击按钮；要求 AI 不编造具体补贴金额、办理时间等细节。
- **官方入口**：吉林省人民政府 `https://www.jl.gov.cn/`；吉林省网上办事大厅 `https://zwfw.jl.gov.cn/jljhszwfww/`。这些是门户入口，不能当成具体事项的直接办理链接。
- **应用内操作**：仅允许固定白名单动作 `guide`, `tab`, `official`。**AI 模型不能直接执行任意 JS、打开任意网页、提交政府业务。**
- **个人信息**：尚无注册登录；用户不应输入身份证号、医保卡号、密码、短信验证码等。用户的提问会发送至 Cloudflare Workers AI 处理。
- **语音**：保持 v0.4 浏览器麦克风方案；语音识别仍受浏览器和 HTTPS 限制。v0.5 主要解决**文字 AI 问答**，不宣称语音问题已解决。
- **正式上线前**：需要详细隐私告知、合规审核、用户认证、强速率与总额度控制、更广泛政策资料来源核验。

## 4. 开发文件

| 文件 | 用途 |
|---|---|
| `public/app.js` | 手机交互、AI 聊天请求、站内跳转 |
| `public/styles.css` | v0.4 已确认的美术基线 |
| `public/index.html` | 首页入口 |
| `public/sw.js` | 静态资源离线缓存，API 永不缓存 |
| `src/knowledge.mjs` | 官方入口、地区列表、政务主题、提示词 |
| `src/worker.mjs` | AI 服务端、输入校验、限流、错误处理 |
| `wrangler.jsonc` | Cloudflare 部署、静态资源和 AI 绑定 |
| `tests/worker.test.mjs` | Node 内置测试 10 项 |
| `tests/browser_flow.py` | Playwright 前端模拟测试脚本 |

## 5. 三人分工建议

| 责任 | 主要交付 | 禁止擅自改动 |
|---|---|---|
| A：你 + ChatGPT | 手机 UI、交互与 AI 端到端集成 | AI API 契约如变动必须同步 |
| B：DeepSeek 协助 | 吉林政务官方政策资料核验、来源表、知识条目 | 不得虚构具体政策、直接覆盖 app.js |
| C：DeepSeek 协助 | 测试用例、部署检查、现场演示资料 | 不得直接把模拟结果标成真实云端测试 |

后端接口唯一约定：

```json
POST /api/chat
{ "question": "养老金资格认证怎么办", "region": "长春市", "history": [] }

200 OK
{
  "text": "...模型生成的导办说明...",
  "region": "长春市",
  "actions": [{"type":"guide","value":"pension","label":"查看养老保险指南"}],
  "sources": [{"title":"吉林省网上办事大厅","url":"https://zwfw.jl.gov.cn/jljhszwfww/","isSpecificDocument":false}]
}
```

## 6. 实测状态

- `node --test tests/*.test.mjs`：10/10 通过；采用假的 AI binding，不代表真实模型效果。
- `python tests/browser_flow.py`：320、390、430px 视口、交互、API 模拟回复、站内按钮跳转、失败提示全部通过；测试运行器会在测试副本中跳过 `about:blank` 的 HTTPS 协议校验，**未修改生产文件的协议限制**。
- **尚未验证**：真机网络延迟、云端模型中文回复质量、Cloudflare 部署授权后的真实推理、竞赛现场网络。

## 7. 后续升级建议（不作为 v0.5 阻塞项）

1. 替换入口级知识为官方具体政策文档的**可追溯来源清单**，先按领域收集 30–50 条材料，再决定是否值得引入向量 RAG。
2. 接入正规账号系统；在此之前只演示昵称和地区，不收集真实个人政务数据。
3. 语音转文字优先复用 Android 原生 ASR 或稳定的云端语音服务，而非依赖本地 HTML 麦克风接口。
4. 校验比赛是否允许不使用 LXClaw，以及联网时是否允许云端 AI。
