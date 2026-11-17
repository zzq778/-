# 吉政知行 · 吉林政务任务智能体 + 文旅行程助手 v0.7.1

用户说出目标（「养老认证怎么查」「两天冬天带孩子去哪」），应用去检索**已人工核对**的知识库，把步骤或行程排出来，并给出站内可点的指南与官方入口。服务目录是辅助入口，不是产品主轴。

**当前状态**：`npm test` **194 项全绿**（16 个测试文件，模型与 Worker 都是模拟调用）；浏览器脚本需要 Playwright + Chromium；**尚未用 Cloudflare 账号部署并验证真实推理**。

## 三条产品线

| 线 | 用户入口 | 交付物 |
|---|---|---|
| 政务导办 | 首页「吉小知」对话 | 事项检索 → 导办步骤 → 站内按钮 + 官方门户 |
| 政策解读 | 服务 → 政策解读 | 6 条已核对政策：一句话读懂 / 谁用得上 / 怎么做 / 易误解点，原文链接限定 `*.jl.gov.cn` |
| 文旅行程 | 首页「文旅行程」 | 出行偏好 → 线路 → 行程卡片：依据抽屉、导出长图、语音朗读、长辈模式 |
| 三端门户 | 我的 → 运营端 → 底部「文旅」 | 游客端 / 商户端 / 政府端三套独立页面，见下节 |

## 代码结构

| 路径 | 作用 |
|---|---|
| `src/worker.mjs` | Worker API：`/api/chat`、`/api/status`；`mode=wenlv` 走文旅五步流水线，`agent` 走政务 Agent，附件走 DeepSeek 路线 |
| `src/agent.mjs` | 受限 Function Calling：`search_services`、`read_service_guide`、`locate_official_portal` |
| `src/knowledge.mjs` | 六类政务入口级资料 + 官方门户白名单（不是政策全文 RAG） |
| `src/uploads.mjs` | 大附件分块暂存（需私有 R2） |
| `src/wenlv/schema.mjs` | 知识库字段规范与校验器（`wenlv-v1`）、官方域名白名单 |
| `src/wenlv/attractions.mjs`、`routes.mjs`、`calendar.mjs`、`entries.mjs` | 知识底座：40 景点 / 12 线路 / 12 时令 / 8 官方入口 |
| `src/wenlv/intent.mjs`、`search.mjs` | D3：一句话意图解析、可解释的检索打分 |
| `src/wenlv/plan.mjs`、`guard.mjs` | D4：行程编排、展示前的引用与措辞校验 |
| `src/wenlv/pipeline.mjs` | D5：五步流水线唯一入口，可单测、可降级 |
| `public/app.js` | 手机 PWA：首页、政务目录、政策解读、对话、我的 |
| `public/itinerary.js`、`itinerary.css` | 文旅行程卡片（数据、偏好、导出、朗读、无障碍） |
| `public/policies.js` | 政务服务「政策解读」数据，核对日期 2026-11-14 |
| `public/wenlv-data.js`、`wenlv-ui.js`、`wenlv-preview.html` | 知识库产物、独立渲染层与免部署预览页 |
| `public/portals/shared/portal-core.js` | 三端共用数据层 + **政府端接入点**（localStorage，可换 fetch） |
| `public/portals/{tourist,merchant,government}/` | 三端独立页面，各自 `index.html` + 自己的 js |
| `public/portal-hub.css` | 「我的 → 运营端」与「文旅」tab 的端容器样式 |
| `scripts/build-wenlv-data.mjs` | `npm run build:data` 生成 `window.WENLV` |
| `scripts/wenlv-ask.mjs`、`wenlv-plan.mjs` | 排障脚本：不调模型，直接打印意图、排序与校验结果 |
| `docs/` | `COMPETITION_AGENT_V070.md`、`WENLV_SCHEMA.md`、`WENLV_DATA_SOURCES.md`、`UX_FLOW.md`、`LXCLAW_INTEGRATION.md` |

## 文旅知识库（D1–D5）

### D1–D2 知识底座

- 40 个景点/场馆覆盖 9 个市州，10 个片区；12 条线路、12 个时令窗口、8 个官方入口。
- **票价、开放时间、预约名额一律不写死**：数据里是 `null`，界面显示「以官方为准」。
- `npm run build:data` 把源模块生成 `public/wenlv-data.js`；`wenlv-preview.html` 是独立预览页（不接 `app.js`）。

### D3 意图解析与检索

- `intent.mjs` 用规则解析：天数（1–3，超出截断并标记）、同行人、市州/片区、主题、月份与季节；只说「吉林省」不会被当成吉林市。
- `search.mjs` 对景点/线路/时令逐条打分（片区、季节、天数、关键词、时令窗口），**每条结果带中文理由**，排序稳定可复现。
- 没抓到条件时走兜底：10 个片区各 1 条代表，并追问「几天、和谁、什么季节」。
- 排障：`node scripts/wenlv-ask.mjs "两天冬天带孩子去哪"`。

### D4 行程编排与校验

- `plan.mjs`：线路优先当骨架，否则按「同片区优先 + 分数」拼；每天三个槽位、节点不重复，每条都带 `why` 与官方来源。车程与票价**不进结构**。
- 提醒分五类：兜底追问、跨片区转场、季节不符、时间/票价未入库、节点偏少。
- `guard.mjs` 展示前过一遍：库外价格/时刻替换为「以官方为准」、非白名单链接移除、绝对化措辞降级、身份证与手机号打码。返回 `{ok, issues, patched}`。
- 20 条幻觉探针全部拦截（`tests/wenlv_guard.test.mjs`）。
- 排障：`node scripts/wenlv-plan.mjs "两天冬天带孩子去哪" --check`。

### D5 Worker 五步流水线

- `POST /api/chat` 带 `{"mode":"wenlv"}`：解析意图 → 检索 → 编排 → **模型只写措辞** → 引用校验。
- **模型认怂也能用**：没有 `AI` 绑定、模型返回空、超时、报错、跑题，一律退回模板答案（`degraded:true` + `reason`），不再 503。
- 旧模式（默认 / `agent` / 附件）行为不变：无 AI 仍返回 503，错误码与跨站校验保持原样。

### 行程卡片（前端四步）

1. **静态版**：首页「文旅行程」入口 → 全屏 sheet，两天时间轴 + 建议停留 + 行前清单。
2. **接真数据**：读 `window.WENLV`，节点带「依据 N」→ 抽屉显示来源名、官方链接、核对日期、置信度；只放行 `OFFICIAL_DOMAINS`（与 `schema.mjs` 由测试比对），非白名单来源直接禁用。
3. **偏好 / 导出 / 错误态**：同行人 × 节奏 × 天数从 12 条线路重排（存本机 `jzzx-iti-prefs`）；纯 canvas 导出 1080px 宽 PNG；弱匹配给 2 条替代，导出不支持 / 存储不可用 / 节点缺数据都有文字出口。
4. **语音 / 长辈模式 / 无障碍**：每天一个「朗读」（Web Speech `zh-CN`，同按钮停止，播报稿只复述卡片内容）；长辈模式正文 19px、次要文字 `#5a6b82`、控件 46px；打开卡片接管焦点并用 `aria-live` 播报，Tab/Shift+Tab 在弹层内循环。

## 三端门户（游客端 / 商户端 / 政府端）

在「我的 → 运营端（文旅）」里选一个端，底部「文旅」就会加载对应的独立页面（同源 iframe，可离线）。三端各有自己的文件夹，互不 import，只共享 `portals/shared/portal-core.js`。

| 端 | 页面 | 内容 |
|---|---|---|
| 游客端 | `portals/tourist/` | 看线路/时令（读 `window.WENLV`）+ 向商户提交反馈，能看到商户或政府的答复 |
| 商户端 | `portals/merchant/` | 证件办理（5 类，状态记录）、提交问题（6 类）、商户档案与经营数据、答复游客反馈 |
| 政府端 | `portals/government/` | **占位页**：接入契约 + 待办列表 + 联调用答复框；正式版由另一位同学开发 |

商户提交问题的 6 类固定为：基础设施问题、交通与停车问题、景区周边环境问题、经营场地问题、政策咨询、文旅活动建议。

商户档案字段：商户名称、联系人、电话、经营类型、经营地址、统一社会信用代码、营业执照编号与有效期、特色产品、相关公开资质；证件办理含营业执照、食品经营、公共卫生、消防、特种行业五类。

**政府端接入点**（详见 `public/portals/README.md`）：

```js
JZZXPortal.government.inbox();                      // 读商户问题 + 游客反馈
JZZXPortal.government.reply('issue'|'feedback', id, text); // 以政府身份答复
JZZXPortal.onChange(refresh);                       // 三端共享的变更通知
```

本地演示边界：数据在浏览器 `localStorage`（key 前缀 `jzzx-portal-v1:`），无登录、无鉴权、不上传文件；换设备或清缓存会丢。换成真实后端时只需改 `portal-core.js` 的读写实现，三端页面不用动。

## 政务服务

- **吉小知**：说目标 → Agent 调工具检索已核对条目 → 导办步骤；可保存本机清单、按步骤标记已了解。
- **政策解读**：6 条政策的数据逐条对应 `xxgk.jl.gov.cn` 原文页，标题/发文机关/文号/日期照抄。解读由参赛项目组撰写，**不是官方解释**，页面已显式标注，并给出原文按钮。

## API 契约

```json
POST /api/chat
{ "question": "两天冬天带孩子去哪", "mode": "wenlv", "region": "长春市" }
```

`mode=wenlv` 的成功响应（节选字段）：

```json
{
  "text": "……",                       // 模型措辞；降级时为模板答案
  "mode": "wenlv",
  "itinerary": { "title": "2 天行程", "days": 2, "plan": [ { "day": 1, "nodes": [ "…" ] } ], "warnings": [], "sources": [] },
  "issues": [],                        // guard 校验发现的问题
  "degraded": false,
  "reason": null,
  "actions": [ { "type": "itinerary", "value": "current" }, { "type": "official", "value": "whhlyt" } ],
  "sources": [],
  "disclaimer": "非政府官方应用；票价与开放时间以景区官方公告为准。"
}
```

其余模式（默认 Chat / `agent` / 附件）的契约与错误码未变；跨站请求仍按 `Origin` 拒绝。

## 数据与合规红线

- 库里没有的数字不编：票价、开放时间、预约名额为 `null` 时，界面写「以官方公告为准」。
- 只允许官方域名（政府门户、景区/场馆官网、运营主体），攻略站、点评站一律拒绝。
- 车程、票价不写进行程结构；行程只排「去哪、什么顺序、为什么」。
- 偏好与清单只存本机 `localStorage`，不上传；不收集身份证、手机号等敏感信息。

## 本地检查

```bash
npm test                            # 194 项，无需 npm install，也不需要 Cloudflare 账号
node scripts/wenlv-ask.mjs "两天冬天带孩子去哪"
node scripts/wenlv-plan.mjs "两天冬天带孩子去哪" --check
npm run build:data                  # 改过 src/wenlv/*.mjs 后重新生成前端数据
```

浏览器脚本（需要 Playwright + Chromium，且要能访问本地服务）：

```bash
python tests/browser_agent.py
python tests/browser_task.py
```

它们是**假 API 响应**下的界面验证，不等于真实 Cloudflare 推理已跑通；`browser_task.py` 因测试环境屏蔽回环 HTTP 而模拟了 localStorage API，并未执行真实上传。

## 上线要求

保留 `AI`、`LIMITER` 绑定。附件多模态需要 `DEEPSEEK_API_KEY`，分块上传需要私有 R2 `UPLOADS` 与 Secret `UPLOAD_SIGNING_KEY`。付费 API 必须先有访问控制或真实用量配额。**不要把密钥提交到仓库**；正式上线先走 PR 审查，不要直接影响已部署的 `main`。

## 比赛合规提醒

2026 年 11 月赛项规则提供指定 LXClaw 平台，且强调现场实操与现场知识库/提示词/工具微调。这一条件没有被现有 Cloudflare 方案自动满足；目前按产品决策暂停 LXClaw 适配，参赛合规风险仍需在正式参赛前确认。

## 诚实的功能边界

已实现：政务工具调用、入口级核验索引、导办步骤、政策解读、文旅知识库与五步流水线、行程卡片全链路（偏好/依据/导出/朗读/无障碍）。

尚未完成：

- LXClaw 集成、政策全文可溯源 RAG、真实用户账户、替用户在官方系统办理业务。
- 真实 Cloudflare 部署与推理验证；真机网络延迟与中文回复质量未经实测。
- 语音朗读依赖浏览器 `speechSynthesis`，真机音色与可用性未逐一验证；导出长图只在 Chromium 内核验证过。
- 行程偏好只影响**选线**，不改变单点编排（`attractions` 暂无「适龄/亲子友好」字段）。

不能把「引导到门户」说成「已经替用户办完业务」；政策解读的措辞不是官方口径，办理以原文为准。

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-11-16 | 文旅知识库 D1–D2：schema、40 景点、12 线路、12 时令、8 入口、独立预览页 |
| 2026-11-17 | D3 意图/检索、D4 编排/校验、D5 Worker 五步流水线（含 20 条幻觉探针） |
| 2026-11-17 | 行程卡片四步：静态版 → 真数据与依据抽屉 → 偏好/导出/错误态 → 语音/长辈模式/无障碍 |
| 2026-11-17 | 三端门户：游客端 / 商户端 / 政府端（独立文件夹），「资讯」改为「文旅」，我的新增运营端切换，政府端留接入契约 |
