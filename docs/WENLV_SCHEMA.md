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
