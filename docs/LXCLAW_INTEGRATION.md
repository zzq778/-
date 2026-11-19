# LXClaw 接入边界（接口尚未确认）

赛项提供指定 LXClaw 平台，但现有规则附件没有公开 HTTP API 路由、JSON 参数或具体工作流导出格式。本工程**没有声称已经接入 LXClaw**。

## 适配目标（内部数据契约，不是 LXClaw 官方接口）

前端到 Agent：`{ question, region, history, context, attachment? }`。

Agent 到前端：`{ text, agent: { trace:[{label,detail}], plan:{id,title,steps} }, actions:[{type,value,label}], sources:[{title,url,scope,isSpecificDocument}] }`。

前端 `actions` 仅允许 guide/official/tab 白名单动作。外部官网动作必须由应用内核验列表提供。

## 接入步骤
1. 获取赛方 QQ 群分发的软件、接口文档、部署/认证说明和对应版本。
2. 核实赛事规定的必备使用条件、是否允许自建前端及额外 API、现场联网/离线政策。
3. 在 LXClaw 中以养老资格认证闭环创建真实工作流：意图识别 → 知识检索 → 根据检索结果选择工具 → 人工确认后进入官方渠道。
4. 只为 LXClaw 官方公开且已验证的调用方式实现桥接；若无可用 API，按赛方要求使用其自带 Web 界面演示，移动端作为独立辅助展示。
5. 录入三份以上可溯源政策材料；现场真正完成知识导入与微调后重测，并记下操作步骤与截图作为内部验收记录。

任何 LXClaw 平台凭证、DeepSeek 密钥都只能配置在服务端或官方平台，不提交到 GitHub。

## 已具备的独立接入路径

本工程提供真实 REST 服务及 OpenAPI 3.1 契约，参阅 JIXIAOZHI_API_V1.md。外部客户端可在获准环境通过独立服务码调用 `POST /api/v1/chat`；Node CLI `scripts/jixiaozhi-chat.mjs` 已通过实际本地 HTTP 集成测试（模型替身，非线上实测）。这证明本项目接口可用，不证明 LXClaw 支持该调用方式。不得将其他名称相近的平台文档当作 LXClaw 官方文档。
