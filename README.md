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

## 文旅知识库（D1–D5 进行中）

服务对象正从政务服务平移到吉林文旅特色产业，先把「知识底座」做扎实，主框架暂不动。

- `src/wenlv/schema.mjs` 字段规范与校验器（`wenlv-v1`）：4 个校验器、10 个片区、官方域名白名单。
- `src/wenlv/attractions.mjs` 40 个景点/场馆，9 个市州全覆盖；`routes.mjs` 12 条线路；`calendar.mjs` 12 条时令窗口；`entries.mjs` 8 个官方入口。
- `npm run build:data` 由上面四个模块生成 `public/wenlv-data.js`（`window.WENLV`），配套 `public/wenlv-ui.js` 渲染；`public/wenlv-preview.html` 是独立预览页（不接 `app.js`）。
- 规范文档：`docs/WENLV_SCHEMA.md`（字段与测试映射）、`docs/WENLV_DATA_SOURCES.md`（来源与合规红线）、`docs/UX_FLOW.md`（体验流程与演示脚本）。
- **行程卡片（第 4 步，语音/长辈模式/无障碍）**：每天一个「朗读」按钮（Web Speech `zh-CN`，同一按钮切换停止，不支持时给文字出口并提示用系统读屏），朗读稿只复述卡片已有内容；长辈模式正文 19px、次要文字加深到 `#5a6b82`、主要控件 46px 触控区、去掉装饰动效；无障碍补齐：打开卡片自动接管焦点并 `aria-live` 播报「已打开行程…」、Tab/Shift+Tab 在弹层内循环、依据按钮 `aria-haspopup="dialog"`、`prefers-reduced-motion` 与 `.motion-off` 都生效。
- **行程卡片（第 3 步，偏好/导出/错误态）**：在真数据与依据抽屉之上，加了「同行人 / 节奏 / 天数」三组偏好（存本机 `localStorage`，key `jzzx-iti-prefs`），按主题权重 + 节奏适配从 12 条线路里重排，同分优先默认演示线路；没有匹配时给最接近的一条 + 2 条替代线路。`导出长图` 用纯 canvas 画 1080px 宽 PNG（不引第三方库），失败时给文字出口。错误态覆盖：知识库未加载（回退示例）、弱匹配（提示 + 替代）、节点缺数据、导出不支持、存储不可用。
- **行程卡片（第 2 步，接真数据）**：`public/itinerary.js` + `public/itinerary.css`，首页「文旅行程」入口 → 全屏 sheet，数据取自 `window.WENLV`（默认线路 `jilin-wusong-2d`），每个节点带「依据 N」按钮 → 抽屉显示来源名、官方链接、核对日期与置信度；只放行 `OFFICIAL_DOMAINS` 白名单（与 `src/wenlv/schema.mjs` 由测试比对），知识库缺失时回退内置 `SAMPLE` 并标注。仍不写票价与开放时间，不调模型、不发请求。
- 票价、开放时间、预约名额一律不写死：数据里为 `null`，界面显示「以官方为准」。

### 意图解析与检索（D3 A 线）

- `src/wenlv/intent.mjs` 用规则解析一句话：天数（1–3，超出截断并标记）、同行人、市州/片区、主题、月份与季节；只说“吉林省”不会被当成吉林市。
- `src/wenlv/search.mjs` 对景点/线路/时令逐条打分（片区、季节、天数、关键词、时令窗口），每条结果都带中文理由，排序稳定可复现。
- 没抓到任何条件时走兜底：10 个片区各 1 条代表，并追问“几天、和谁、什么季节”。
- 排障：`node scripts/wenlv-ask.mjs "两天冬天带孩子去哪"` 直接打印理解结果与三类排序，不调模型。

### 行程编排与校验（D4 A 线）

- `src/wenlv/plan.mjs` 把意图与检索结果排成结构化行程：线路优先当骨架，否则按「同片区优先 + 分数」拼；每天三个槽位，节点不重复，每条都带 `why` 与官方来源。
- 提醒分五类：兜底追问、跨片区转场、季节不符、时间/票价未入库、节点偏少；车程与票价一律不写进结构。
- `src/wenlv/guard.mjs` 在展示前过一遍：库外价格/时刻替换为「以官方为准」、非白名单链接移除、绝对化措辞降级、身份证与手机号打码、库里没有的景点名标出来。返回 `{ok, issues, patched}`，`patched` 可直接展示。
- 排障：`node scripts/wenlv-plan.mjs "两天冬天带孩子去哪" --check` 看结构与校验结果。

### Worker 流水线（D5 A 线）

- `POST /api/chat` 带 `{"mode":"wenlv"}` 时走五步流水线：解析意图 → 检索 → 编排 → 模型只写措辞 → 引用校验；响应回 `text` + `itinerary` + `issues` + `degraded`，前端可直接渲染行程卡片。
- 模型认怂也能用：没有 `AI` 绑定、模型返回空、超时、报错、跑题，一律退回模板答案（`degraded:true` 并给出 `reason`），不再 503。
- 旧模式（默认 / `agent` / 附件）行为不变：没有 AI 仍返回 503，错误码与跨站校验保持原样。
- `src/wenlv/pipeline.mjs` 是唯一入口，可单测：同样的输入与同样的模型输出，答案逐字相同。

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
