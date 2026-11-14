# 吉政知行 · 吉林政务任务智能体 v0.7.1

目标：让用户提出办事目标，由 Agent 检索已核对的政务索引、整理导办步骤，并生成可点击的应用内指南和官方入口。服务目录是辅助入口，不是产品主轴。

## 代码结构
- `public/` 手机 PWA；主要入口在首页的“吉小知”，支持本机保存一份导办清单、按步骤标记已了解，并从首页或“我的”继续。
- `src/agent.mjs` 受限的模型 Function Calling 和工具执行：`search_services`、`read_service_guide`、`locate_official_portal`。
- `src/knowledge.mjs` 当前六类入口级政务资料和官方门户白名单，不是最新政策全文 RAG。
- `src/worker.mjs` Cloudflare Worker API；`mode=agent` 文本走 Agent，附件仍走原有 DeepSeek 路线。
- `src/uploads.mjs` 大附件分块暂存（需 R2）。
- `docs/COMPETITION_AGENT_V070.md` 赛项要求、产品主线、风险、分工和验收要求。
- `docs/LXCLAW_INTEGRATION.md` 赛事指定 LXClaw 平台接入前必须核对的事项（**尚未完成接入**）。

## 本地检查

```bash
npm install
npm test
python tests/browser_agent.py
python tests/browser_task.py
```

`npm test` 是使用模拟模型调用的逻辑测试；浏览器脚本用假 API 响应验证界面，不等于真实 Cloudflare 推理已跑通。新任务脚本因测试环境屏蔽回环 HTTP 而模拟 localStorage API，并未执行真实服务端上传。`tests/browser_agent.py` 依赖 Chromium 和 Playwright，且其测试只内联 CSS/JS 以绕过本地 HTTP 访问限制。

## 上线要求
保留现有 `AI`、`LIMITER` 绑定。附件多模态需要服务端 `DEEPSEEK_API_KEY`，分块上传需要私有 R2 `UPLOADS` 与 Secret `UPLOAD_SIGNING_KEY`。付费 API 必须先有访问控制或真实用量配额。**不要把密钥提交到仓库**。正式上线先通过 GitHub PR 审查，避免直接影响已部署的 `main`。

## 比赛合规提醒
2026 年 11 月赛项规则提供指定 LXClaw 平台，且强调现场实操和现场知识库/提示词/工具微调。这一条件没有被现有 Cloudflare 方案自动满足。目前按产品决策暂停 LXClaw 适配，参赛合规风险仍需在正式参赛前确认。

## 诚实的功能边界
当前已实现工具调用、经过核验的入口级索引、导办步骤、站内按钮。尚未完成 LXClaw 集成、政策全文可溯源 RAG、真实用户账户和官方系统自动操作。不能把用户引导到门户描述成已经替用户办理业务。
