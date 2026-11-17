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
- `public/policies.js` 政务服务「政策解读」：6 条已核对政策，原文链接限定 `*.jl.gov.cn`，每条含要点、一句话读懂、适用人群与行动建议，列表/详情两态，核对日期 2026-11-14。

## 文旅知识库（D1–D2 进行中）

服务对象正从政务服务平移到吉林文旅特色产业，先把「知识底座」做扎实，主框架暂不动。

- `src/wenlv/schema.mjs` 字段规范与校验器（`wenlv-v1`）：4 个校验器、10 个片区、官方域名白名单。
- `src/wenlv/attractions.mjs` 40 个景点/场馆，9 个市州全覆盖；`routes.mjs` 12 条线路；`calendar.mjs` 12 条时令窗口；`entries.mjs` 8 个官方入口。
- `npm run build:data` 由上面四个模块生成 `public/wenlv-data.js`（`window.WENLV`），配套 `public/wenlv-ui.js` 渲染；`public/wenlv-preview.html` 是独立预览页（不接 `app.js`）。
- 规范文档：`docs/WENLV_SCHEMA.md`（字段与测试映射）、`docs/WENLV_DATA_SOURCES.md`（来源与合规红线）、`docs/UX_FLOW.md`（体验流程与演示脚本）。
- **行程卡片（第 2 步，接真数据）**：`public/itinerary.js` + `public/itinerary.css`，首页「文旅行程」入口 → 全屏 sheet，数据取自 `window.WENLV`（默认线路 `jilin-wusong-2d`），每个节点带「依据 N」按钮 → 抽屉显示来源名、官方链接、核对日期与置信度；只放行 `OFFICIAL_DOMAINS` 白名单（与 `src/wenlv/schema.mjs` 由测试比对），知识库缺失时回退内置 `SAMPLE` 并标注。仍不写票价与开放时间，不调模型、不发请求。
- 票价、开放时间、预约名额一律不写死：数据里为 `null`，界面显示「以官方为准」。

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

政策解读中的「一句话读懂 / 适用人群 / 行动 / 提醒」由参赛项目组撰写，**不是官方解释**，办理口径以原文为准；页面里已显式标注这一点。
