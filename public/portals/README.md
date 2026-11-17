# 三端门户（游客端 / 商户端 / 政府端）

三个端各自一个文件夹，**互不 import**，共用一个数据层 `shared/portal-core.js`：

```
public/portals/
├── shared/portal-core.js   数据层 + 政府端接入点（三端唯一共享文件）
├── shared/portal.css       三端共用样式
├── tourist/               游客端：看线路/时令 + 向商户反馈
├── merchant/              商户端：证件办理 / 提交问题 / 商户档案 / 答复反馈
└── government/            政府端：待办处理 / 证件审核 / 数据概览 / 说明
```

主应用「我的 → 运营端」选择端，底部「文旅」按所选端加载对应 `index.html`（iframe 嵌入，同源、可离线）。

## 数据（localStorage，同源共享）

| key | 内容 | 写入方 |
|---|---|---|
| `jzzx-portal-v1:merchant` | 商户档案：名称/联系人/电话/经营类型/地址/执照/特色产品/公开资质 + 证件状态 | 商户端 |
| `jzzx-portal-v1:issues` | 商户提交的问题（6 类）+ 答复消息 | 商户端 / 政府端 |
| `jzzx-portal-v1:feedback` | 游客反馈 + 答复消息 | 游客端 / 商户端 / 政府端 |
| `jzzx-portal-role` | 主应用当前选择的端 | 主应用 |

问题 6 类（固定）：基础设施问题、交通与停车问题、景区周边环境问题、经营场地问题、政策咨询、文旅活动建议。

## 政府端接入点（契约）

政府端只需实现三件事，商户端/游客端不用改：

```js
// 1) 读待办：商户问题 + 游客反馈，按时间倒序
const inbox = JZZXPortal.government.inbox();
// item: { type:'issue'|'feedback', id, status, category(Labels), title|text, messages[], ... }

// 2) 答复：写回同一份存储，商户端与游客端会看到
JZZXPortal.government.reply('issue' | 'feedback', id, '答复内容');

// 3) 变更通知：三个端都在监听
JZZXPortal.onChange(refresh);          // 推荐
window.addEventListener('storage', refresh); // 也可以直接用原生事件
```

可选：`JZZXPortal.government.register(fn)` 注册同页面适配器（同页签内立即回调）。

## 政府端已经做了什么（本轮补齐）

`government/government.js` 只负责渲染与事件，规则在 `government/gov-logic.js`（纯函数，Node 可直接测，不碰 DOM / 网络 / localStorage）：

| 能力 | 说明 |
|---|---|
| 待办 | 商户问题 + 游客反馈汇总；按状态（待处理/已答复/逾期）、类型、类别、关键词筛选；待处理超 24 小时标「逾期未答复」 |
| 答复 | 受理 / 转办 / 要求补充 三条草稿，人工改完再提交，写回同一份数据 |
| 证件审核 | 商户端提交的 5 类证件，通过 / 退回即时回写，商户端刷新可见 |
| 数据概览 | 答复率、平均首答、类别分布、近 7 天新增、本月时令（读 `wenlv-data.js`） |
| 导出 | 待办 CSV 与摘要文本，用于汇报与复盘 |

草稿只写流程，不写时限、金额、文号——避免演示现场把没核实的话说死。

## 换真实后端时改哪里

只改 `shared/portal-core.js` 的 `read` / `write`：

- 读：`fetch('/api/portal/merchant')` 之类；
- 写：`fetch(..., { method:'POST' })`；
- `government.reply` 换成 `POST /api/portal/reply`。

三端页面的调用方式（`JZZXPortal.issues.add`、`feedback.reply`……）保持不变。

## 明确边界

- 这是**本地演示数据层**：没有登录、没有鉴权、没有服务端校验，任何能打开同源页面的人都能读写。
- 换设备、清缓存会丢数据；不能当作真实的政务审批、实名或备案系统。
- 证件只记录类型与状态，**不上传文件**；真实办理仍需在政务系统提交材料。
- 商户执照编号在列表里做了遮挡（首尾可见），但完整值存在本机 localStorage，演示时别在公共设备上填真实编号。
- 政府端的答复、证件审核与导出都是**演示实现**：真实工单需要权限、留痕、审批与时限，本机数据没有鉴权，不能当作政务系统。
