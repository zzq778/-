# 文旅知识库 · 字段规范（D1–D2 / A 线交付）

版本：`wenlv-v1`（对应 `src/wenlv/schema.mjs` 的 `SCHEMA_VERSION`）

## 一、三条硬规则

1. **结构由代码给，模型只写措辞**。行程卡片、时间轴、预算表的字段全部来自结构化数据；模型不负责生成"第几天去哪、门票多少"。
2. **会变的字段允许为 `null`**。`null` 的语义是"未核对"，不是"没有"。界面遇到 `null` 必须显示"以官方为准"，不能猜。
3. **每条事实都有出处**。没有 `sources` 的条目不允许进库，测试会拦。

## 二、五张表

| 表 | 文件 | 状态 | 说明 |
|---|---|---|---|
| 景点/场馆 | `src/wenlv/attractions.mjs` | ✅ 40 条 | 9 个市州全覆盖，10 个片区各≥1 |
| 线路模板 | `src/wenlv/routes.mjs` | ✅ 12 条 | 天数 → 片区 → 节点顺序，不写车程与票价 |
| 节庆与季节 | `src/wenlv/calendar.mjs` | ✅ 12 条 | 冬捕、雾凇期、花期、观鸟、民俗 |
| 官方入口 | `src/wenlv/entries.mjs` | ✅ 8 条 | 省/市州/管委会/场馆官网；12345 由 `HELPLINE` 单独提供 |
| 校验与检索 | `src/wenlv/schema.mjs` | ✅ | 枚举、四个校验器；打分留 D3 |

## 三、attractions 字段表

| 字段 | 类型 | 必填 | 约束 | 示例 |
|---|---|---|---|---|
| `id` | string | ✅ | `^[a-z0-9]+(-[a-z0-9]+)*$`，全库唯一 | `changbaishan-bei` |
| `name` | string | ✅ | 2–30 字，用官方全称 | `长白山北景区` |
| `aliases` | string[] | ✅ | 0–6 个，检索用，去重 | `['长白山','天池']` |
| `area` | string | ✅ | 枚举 `AREAS`（9 个市州） | `延边州` |
| `cluster` | string | ✅ | 枚举 `CLUSTERS`（10 个片区） | `changbaishan` |
| `kind` | string | ✅ | 枚举 `KINDS` | `自然` |
| `level` | string \| null | ✅ | `'5A' \| '4A' \| '3A' \| null` | `5A` |
| `tags` | string[] | ✅ | 1–6 个，每项 ≤ 12 字 | `['天池','避暑']` |
| `season.best` | string[] | ✅ | ≥1 个，枚举 `SEASONS` | `['summer','winter']` |
| `season.note` | string | ⬜ | ≤ 40 字，说明季节限制 | `冬季主峰视天气开放` |
| `hours` | string \| null | ✅ | **未核对必须为 null** | `null` |
| `ticket` | string \| null | ✅ | **不写价格区间**，未核对为 null | `null` |
| `booking` | string \| null | ⬜ | 预约方式的口径描述 | `官方小程序实名预约` |
| `sources` | Source[] | ✅ | ≥1 条，域名必须在白名单 | 见下 |
| `verifiedAt` | string | ✅ | `YYYY-MM-DD`，不得晚于今天 | `2026-11-17` |
| `confidence` | string | ✅ | `high \| medium \| low` | `high` |
| `caveat` | string | ✅ | ≥8 字；`hours`/`ticket` 为 null 时必须含"官方" | `票价以官方公告为准` |

### Source 结构

| 字段 | 类型 | 约束 |
|---|---|---|
| `label` | string | 来源主体名，如 `长白山管委会` |
| `url` | string | `http(s)`，域名在 `OFFICIAL_DOMAINS` 白名单内 |
| `kind` | string | `gov`（政府）\| `official`（景区/单位官网）\| `operator`（运营公司） |

### 枚举

```js
AREAS     = ['长春市','吉林市','四平市','辽源市','通化市','白山市','松原市','白城市','延边州']
CLUSTERS  = ['changchun','jilin-city','songhuahu','wusong','changbaishan',
             'chaganhu','yanbian','jian','xianghai','siping']
KINDS     = ['自然','人文','民俗','遗址','工业','冰雪']
SEASONS   = ['spring','summer','autumn','winter']
LEVELS    = ['5A','4A','3A', null]
ROUTE_SLOTS = ['上午','午后','傍晚']
EVENT_TYPES = ['节庆','花季','观鸟','冰雪','民俗','景致']
ENTRY_KINDS = ['gov','official','hotline','service']
```

`CLUSTER_LABELS` 提供片区中文名（前端芯片用），新增片区必须同时补枚举与中文名，测试会核对两者数量一致。

`CLUSTERS` 与 `AREAS` 是多对一：一个片区可以跨市州（长白山跨延边与白山），所以两条字段都保留，筛选时用 `area`，行程编排时用 `cluster`。

## 四、id 命名规范

```
<片区关键词>-<特征>[-<序号>]
changbaishan-bei      长白山北景区
wusongdao             雾凇岛
weimanhuanggong       伪满皇宫博物院
gaogouli-ji-an        集安高句丽
```

- 全小写、连字符分词、不含拼音声调与下划线；
- 一旦对外引用（测试、缓存、分享链接）不得改名，改内容不改 id；
- 新增条目先查重，id 冲突测试会失败。

## 五、routes / calendar / entries 字段表

### routes（12 条）

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | string | 命名同第四节，全库唯一 |
| `title` | string | 2–30 字，形如"几天 + 主题" |
| `days` | number | 1–3 |
| `cluster` | string | 枚举 `CLUSTERS` |
| `areas` | string[] | ≥1，枚举 `AREAS` |
| `season` | string[] | ≥1，枚举 `SEASONS` |
| `summary` | string | 20–80 字：这条线适合谁、解决什么 |
| `nodes` | Node[] | ≥2 个；`{day,slot,attractionId,why}`，`day ≤ days`，`slot ∈ ROUTE_SLOTS`，`attractionId` 必须能在景点库命中 |
| `sources` / `verifiedAt` / `confidence` / `caveat` | | 同 attractions |

**节点里禁止写车程、票价、精确时刻**：这三类字段会变且没有稳定出处，口径统一放 `caveat`，由界面提示"以官方为准"。

### calendar（12 条）

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` / `name` | string | 命名同规范；名称 2–30 字 |
| `cluster` | string | 枚举 `CLUSTERS` |
| `type` | string | 枚举 `EVENT_TYPES` |
| `months` | number[] | 1–12，升序且不重复 |
| `window` | string | 8–40 字，如"每年 12 月下旬至次年 2 月" |
| `why` | string | ≥12 字：为什么这个时间来 |
| `sources` 等 | | 同上 |

### entries（8 条）

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` / `name` | string | `name` 用单位全称 |
| `kind` | string | 枚举 `ENTRY_KINDS` |
| `scope` | string | `province` 或市州名 |
| `url` | string | `http(s)`，域名须在 `OFFICIAL_DOMAINS` |
| `note` | string | ≤ 40 字，说明能查到什么 |

`12345` 不放进 entries，单独由 `HELPLINE` 提供，避免把热线号码混进官网链接列表。

## 六、校验与测试映射

| 规则 | 测试用例 |
|---|---|
| 结构完整、必填非空 | 每条通过 `validateAttraction` / `validateRoute` / `validateEvent` / `validateEntry` |
| id 唯一、命名合规 | `id 唯一` |
| 域名白名单 | `来源域名必须在白名单` |
| 空值带提示 | `hours/ticket 为 null 时 caveat 含官方` |
| 枚举合法 | `area/cluster/kind/level/season 合法` |
| 时效 | `verifiedAt 格式合法且不晚于今天` |
| 覆盖面 | `9 个市州全覆盖`、`10 个片区各至少 1 条` |
| 线路引用完整 | `线路引用的景点都存在`、`节点天数不超过线路天数` |
| 不写死易变事实 | `节点里没有价格或时刻` |
| 生成文件同步 | `wenlv-data.js 与 src 一致`（改数据后必须 `npm run build:data`） |
| 意图解析不瞎猜 | `空输入不猜条件`、`只说吉林省不硬塞吉林市`、`明说的季节优先于月份推断` |
| 检索排序可解释 | `季节不符要扣分`、`天数匹配加分`、`每条推荐都带理由`、`同样的输入得到同样的结果` |
| 行程结构可控 | `节点不重复`、`槽位顺序固定`、`来源全部是官方域名`、`要求五天也只排三天` |
| 不把没根据的话说成事实 | 20 条探针（`20 条探针全部被拦下`）、`干净句子不误伤`、`行程文本能通过校验` |

## 七、演进约定

- 加字段 = 升版本（`wenlv-v2`），旧条目必须能通过新校验，否则先补数据再加规则；
- 删字段要先 `grep` 全库引用（`src/wenlv/`、`tests/`、前端渲染）；
- 数据文件只导出冻结数组与纯函数，**不在这里发网络请求**（便于 `node:test` 在无网络环境跑）。

## 八、数据流水线与预览

```
src/wenlv/{schema,attractions,routes,calendar,entries}.mjs   ← 唯一事实来源（Node ESM）
        │  npm run build:data （scripts/build-wenlv-data.mjs）
        ▼
public/wenlv-data.js        window.WENLV 镜像，生成物，禁止手改
        │  + public/wenlv-ui.js（渲染：芯片/景点卡/时令卡/线路轴）
        ▼
public/wenlv-preview.html   D2 验收用独立预览页（不依赖 app.js）
```

- `public/wenlv-data.js` 由脚本生成，测试 `tests/wenlv_preview.test.mjs` 会比对它与 `src/` 是否一致——改了数据不跑 `build:data` 会红；
- 预览页是**旁路验证**，不接 `app.js`；接主应用留到 D5 五步流水线，避免早期破坏四 tab 结构；
- `build:data` 需要写 `public/`，在受限 shell 沙箱里会 `EPERM`，用完全权限跑一次即可。

## 九、意图解析与检索（D3 A 线）

### 链路

```
用户一句话
  → parseIntent（src/wenlv/intent.mjs）      规则解析：天数/同行人/片区/主题/月份/季节
  → retrieve（src/wenlv/search.mjs）         逐条打分：景点 / 线路 / 时令
  → 编排（D4）→ 模型只写措辞（D5）→ 引用校验（D4）
```

原则不变：**结论由代码算，模型只负责把它说成人话**。所以排序结果可复现、可解释、可测。

### parseIntent 输出

| 字段 | 类型 | 说明 |
|---|---|---|
| `text` | string | 原始输入（已 trim、截断 300 字） |
| `days` | number \| null | 实际采用的天数（1–3） |
| `daysRequested` | number \| null | 用户原话里的天数，可能被截断 |
| `daysClamped` | boolean | 是否因 `MAX_DAYS=3` 被截断 |
| `companions` | string[] | 长辈 / 亲子 / 情侣 / 朋友 / 独自 / 研学 / 团队 |
| `themes` | string[] | 冰雪 / 雾凇 / 冬捕 / 自然 / 天池 / 人文 / 民俗 / 遗址 / 工业 / 亲子 / 研学 / 美食 / 边境 / 摄影 / 温泉 / 自驾 / 红色 / 观鸟 / 避暑 / 徒步 |
| `themeWords` | string[] | 命中的原始词，便于排查“为什么判成这个主题” |
| `areas` | string[] | 9 个市州 |
| `clusters` | string[] | 10 个片区 |
| `season` | string | `spring/summer/autumn/winter`，明说优先，否则按月推断 |
| `month` | number | 1–12 |
| `provinceWide` | boolean | 只说“吉林省”时为 true（不代表吉林市） |
| `signals` | number | 命中条件总数，为 0 时走兜底 |
| `confidence` | string | `high / medium / low`，用于演示时提示“要不要追问” |

### 解析优先级（都写死在代码里，避免模型猜）

1. 天数：明说数字 > 阿拉伯数字 > 中文数字 > “周末”=2 > “一日游”=1；超过 3 天截断并置 `daysClamped`。
2. 季节：明说（“冬天/雪季”）> 月份推断（12/1/2 冬、3–5 春、6–8 夏、9–11 秋）。
3. 地点：片区词优先于市州词；**裸“吉林”只当省域**，不映射成吉林市（否则用户说“吉林省”会被塞进一个市）。
4. 主题：词表匹配，长词优先（“长白山天池”→“天池”而不是“自然”）。
5. 同行人：单独成字段，同时参与主题匹配（“带孩子”→“亲子”）。

### 检索打分

| 因素 | 分值 | 说明 |
|---|---|---|
| 片区命中 | +6 | `attraction.cluster` 在 `intent.clusters` 内 |
| 市州命中 | +4 | `attraction.area` 在 `intent.areas` 内 |
| 类型命中 | +5 | 主题映射到 `kind`（如“遗址”→“遗址”） |
| 关键词命中 | 每条 +2，上限 3 条 | `tags / name / aliases` 命中 `intent.themeWords` |
| 季节契合 | +3 | `season.best` 含当前季节 |
| 季节不符 | −2 | 有季节信息但不在 `best` 里 |
| 线路天数契合 | +5 | `route.days === intent.days` |
| 线路天数不符 | −2 | 有天数但不等 |
| 线路主题命中 | 每条 +2，上限 3 条 | 节点所在景点或标题命中主题 |
| 时令月份命中 | +4 | 当前月份在 `event.months` 内 |
| 时令片区命中 | +5 | `event.cluster` 命中 |
| 时令主题命中 | +2 | `event.type` 映射到主题 |

排序：`score` 降序，同分按 `id` 升序（保证每次结果一致，方便截图与验收）。

### 理由短语

每条结果都带 `reasons: string[]`，界面直接展示，评委能看到“为什么推荐它”：

- `片区：查干湖` / `提到：冬捕` / `适合冬季` / `非夏季首选`
- `2 天，正好` / `非 2 天线路` / `12 月正在窗口` / `贴合：冬捕` / `片区代表`

### 兜底与追问

- `signals === 0`（用户只说“随便看看”）：走 `featuredAttractions()`——10 个片区各挑 1 条代表（5A 优先），附一句追问“想玩几天、和谁去、什么季节？”；
- 非兜底：过滤掉 0 分条目（全 0 才保留 1 条），避免把无关内容塞给用户；
- 同一句话两次调用结果完全一致（`deepEqual` 有测试守着）。

### 排障用法

```bash
node scripts/wenlv-ask.mjs "两天冬天带孩子去哪"
node scripts/wenlv-ask.mjs "12月去查干湖看冬捕" --limit=3
```

它只跑“解析 → 检索 → 打印”，**不调模型**：现场出问题时能立刻分辨是数据/规则错了，还是模型措辞错了。

## 十、行程编排与引用校验（D4 A 线）

### 链路位置

```
parseIntent → retrieve → buildItinerary（本步）→ 模型只写措辞（D5）→ guardAnswer（本步）
```

编排负责「骨架」，校验负责「别把没根据的话说成事实」。两步都不依赖模型，所以都能被 `node:test` 直接测。

### buildItinerary 输出

| 字段 | 说明 |
|---|---|
| `version` | `itinerary-v1` |
| `days` | 1–3，超出按 3 处理 |
| `clusters` | 行程实际涉及的片区（去重） |
| `sourceRouteId` | 用哪条线路当骨架；按检索结果拼时为 `null` |
| `plan[].title` | `第 1 天 · 长白山` 这类可读标题 |
| `plan[].nodes[]` | `{day, slot, attractionId, name, area, cluster, kind, level, why, caveat, booking, sources}` |
| `tips` | 不含编造事实的通用清单（确认开放时间、优惠资格、季节装备、机动时间） |
| `warnings[]` | 见下表 |
| `sources[]` | 去重后的官方来源（≤6 条） |
| `meta` | `{intent, confidence, generator}`，`intent` 是 D3 的一句话解释 |

### 编排规则

1. **骨架优先**：检索出的线路分数 > 0 且天数与需求一致时，直接采用线路节点顺序（线路本身就是人评审过的动线）。
2. **兜底拼接**：没有合适线路时，按「同片区优先 → 分数高 → id 升序」取景点，每天 3 个槽位（上午 / 午后 / 傍晚），不重复。
3. **不写易变事实**：车程、票价、精确时刻一个都不进结构；需要时由界面提示「以官方为准」。
4. **可复现**：同样的输入必须产出完全相同的行程（`deepEqual` 有测试守着），现场截图与 PPT 才对得上。

### 提醒类型

| type | 触发条件 | 作用 |
|---|---|---|
| `fallback` | 检索走兜底（`signals === 0`） | 提示先追问「几天、和谁、什么季节」 |
| `cross-cluster` | 行程跨 2 个以上片区 | 提醒预留转场时间，车程以导航为准 |
| `season-mismatch` | 节点不在当前季节的 `season.best` 里 | 点名是哪几个点，避免「冬天去避暑地」 |
| `unsourced-facts` | 任一点 `hours`/`ticket` 为 `null` | 统一说明为什么不写死，改由官方渠道确认 |
| `thin-plan` | 节点数 < 天数 × 2 | 建议放宽片区或留一天机动 |

### guardAnswer 检查项

| 类型 | 识别方式 | 处理 | 严重度 |
|---|---|---|---|
| `unsupported-price` | `¥120` / `80 元` 且数字不在事实集 | 替换为「官方公布的价格」 | high |
| `unsupported-time` | `8:30`、`9：00` 这类时刻且不在事实集 | 替换为「官方公布的时间」 | high |
| `untrusted-url` | 域名不在 `OFFICIAL_DOMAINS` | 整段移除 | medium |
| `overclaim` | 保证 / 100% / 官方指定 / 绝对 等 11 个词 | 降级为「通常可以」这类说法 | medium |
| `pii` | 18 位身份证、11 位手机号 | 打码 | high |
| `unknown-entity` | `XX景区 / 博物馆 / 滑雪场 …` 且库里没有 | 仅标记，不改写 | low |

`buildFacts(itinerary)` 决定「哪些数字/时刻/链接算有依据」：库里有凭据的可以放行，没有的一律拦。返回值 `{ok, issues, patched}`，`patched` 是可以直接展示的版本。

### 为什么不用模型做校验

模型做校验有三宗罪：贵、慢、不可复现。评委现场问「你怎么保证不编票价」时，正解是「票价根本没进库，结构由代码给，措辞过白名单」——而不是「我再让模型复核一遍」。

### 已知局限（写出来，免得被问住）

- `unknown-entity` 是启发式：为了不误伤「满族古镇」这类描述性说法，名字与库里已有名称共享 2 字以上片段时会放行，因此「长白山 X 玻璃栈道」这种改编名可能漏网；
- guard 只拦「形如事实」的表述（价格、时刻、链接、证件），拦不住「推荐得合不合理」；
- `tips` 是通用建议，不含具体时间、费用、名额，避免哪天过期。

### 排障用法

```bash
node scripts/wenlv-plan.mjs "两天冬天带孩子去哪"           # 看结构
node scripts/wenlv-plan.mjs "12月去查干湖看冬捕" --check   # 顺手跑一遍校验
```

## 十一、Worker 五步流水线（D5 A 线）

### 一次请求发生了什么

```
POST /api/chat { question, mode: "wenlv" }
   ├─ 校验：content-type / origin / 体积 / 空问题 / 限流   （原有逻辑，未改）
   ├─ parseIntent   规则解析天数、同行人、片区、主题、季节
   ├─ retrieve      景点/线路/时令打分，带理由
   ├─ buildItinerary 结构化行程（线路优先，否则拼接）
   ├─ 模型          只复述结构、不新增事实（无绑定/超时/跑题则跳过）
   └─ guardAnswer   价格、时刻、外链、绝对化措辞、PII 全过一遍
 → { text, mode, model, itinerary, issues, degraded, reason, actions, sources }
```

### 响应字段

| 字段 | 说明 |
|---|---|
| `text` | 可直接展示的中文答案（模板或模型润色后过校验的版本） |
| `mode` | `wenlv` |
| `model` | 实际用了模型时为模型名，否则 `wenlv-template` |
| `itinerary` | 结构化行程（`plan.mjs` 的完整输出，第 1 天到第 N 天） |
| `issues` | 校验发现的问题（`[]` 表示干净） |
| `degraded` | 是否降级过（模板兜底或清洗过模型措辞） |
| `reason` | `no-model` / `empty` / `timeout` / `model-error` / `off-topic` / `sanitized` / `patched` / `null` |
| `actions` | `itinerary`（打开行程卡片）+ `official`（官方入口） |
| `sources` | 行程用到的官方来源 |

### 降级矩阵

| 情况 | 结果 | 用户看到 |
|---|---|---|
| 没有 `AI` 绑定 | 模板答案，`degraded:true`，`reason:no-model` | 完整行程 + 提醒 |
| 模型返回空 | 模板答案，`reason:empty` | 完整行程 |
| 模型超时（>9s） | 模板答案，`reason:timeout` | 完整行程 |
| 模型报错 | 模板答案，`reason:model-error` | 完整行程 |
| 模型没提到任何行程景点 | 模板答案，`reason:off-topic` | 完整行程 |
| 模型编了价格/时刻 | 整段退回模板，问题记录在 `issues`，`reason:sanitized` | 完整模板行程（不展示改了一半的句子） |
| 模型只用了绝对化措辞 | 软化措辞后照用，`reason:patched` | 行程 + 软化后的说法 |

**关键取舍**：文旅模式下没有 AI 也返回 200，因为结构来自本地知识库，不需要模型。旧模式没有 AI 仍然 503——契约不因新功能而放宽。

### 提示词边界

`WENLV_SYSTEM_PROMPT` 只允许模型做三件事：复述景点、复述顺序与理由、加一句提醒。它被明确禁止：新增景点、写票价/开放时间/车程/名额、使用绝对化措辞、输出网址与 Markdown。

模型输出的兜底检查还有一条：答案里必须出现行程中的至少一个景点名，否则判为跑题——这条挡住“模型开始自由发挥”的常见开头。

### 测试映射

| 关注点 | 用例 |
|---|---|
| 契约不变 | `原有模式不受影响：无 AI 仍返回 503 NO_AI`、`/api/status 语义未变`、`非 JSON 请求体依旧 415` |
| 文旅可用 | `mode=wenlv 返回行程结构与可读答案`、`没有 AI 绑定时文旅仍能回答` |
| 模型不靠谱时站得住 | `模型返回空`、`模型超时`、`模型抛错`、`模型跑题` |
| 不编事实 | `模型编了票价`、`模型给了外部链接`、`提示词把规则写给模型` |
| 可复现 | `同样的输入与同样的模型输出得到同样的答案` |
