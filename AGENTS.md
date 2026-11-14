# 吉政知行 · AI 接入版 — 编码智能体工作约定

本文件由 DSH（DeepSeek Harness）在会话首次请求时自动加载（`AGENTS.md` / `CLAUDE.md` 链，项目根 → 当前工作目录）。改这里就能改变后续所有会话的行为，不需要改任何 DSH 配置。

## 这个仓库是什么

Cloudflare Worker + 静态 PWA 的政务问答 demo：

| 位置 | 作用 |
|---|---|
| `src/worker.mjs` | Worker 入口与 `/api/chat`、`/api/status`；调用 Workers AI |
| `src/knowledge.mjs` | 已核对的官方入口知识、选题、系统提示词 |
| `public/` | 前端 PWA（首页、地区、政务入口、AI 悬浮胶囊） |
| `tests/worker.test.mjs` | 后端单测（AI 被 mock，无需 Cloudflare 账号） |
| `tests/browser_flow.py` | 端到端浏览器流程测试（需先起本地服务） |
| `wrangler.jsonc` | Cloudflare 部署绑定（`AI`、`ASSETS`、`LIMITER`） |

模型：`@cf/zai-org/glm-4.7-flash`，通过 `env.AI` 绑定调用，仓库内不保存任何模型 Key。

## 硬性约定

- **基分支 `main`，禁止直接推送**。一律 `fix/…` 或 `feat/…` 分支 + PR。
- **推送前必须跑 `npm test`**；动到前端再跑 `python3 tests/browser_flow.py`（它需要 `npm run dev` 已启动）。
- 提交信息用 `fix|feat|chore|docs|test(scope): 说明`，正文写清「根因 / 改法 / 验证证据」。
- PR 正文与评论一律中文（本仓库文档为中文）。
- 不执行 `npm run deploy` / `wrangler deploy`，除非用户在当轮对话里明确要求——那会写真实 Cloudflare 账号。
- 不把 API Key、account id、真实生产域名写进仓库。
- `吉政知行_真实AI接入工程_v0.5.zip` 是交付快照，不参与日常改动。
- 合入 PR 需要用户确认，智能体不自行 merge。

## 环境事实（已实测）

- `npm test` 在纯净 clone 上可直接跑通，不需要 `npm install`（测试只依赖 `node:test`）。
- 真实推理需要 `env.AI` 绑定；`/api/status` 返回 `ready:true` 只证明绑定存在，不证明模型可用。
- GLM 这类思考型模型会返回 HTTP 200 但正文为空（推理占满预算 / 内容被过滤），`src/worker.mjs` 已把空正文映射为 `EMPTY_AI` 502；改动这条路径时不要退回「空串当成功」。

## 详细流程

一次完整的「改代码 → 提 PR → 发评论」流程见技能 `.dsh/skills/dsh-github-flow/SKILL.md`。
