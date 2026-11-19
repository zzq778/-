# 吉政知行 × LXClaw 1.19.15
本适配层以安装包内置的 OpenClaw mcp.md / skills.md 为依据：mcp.servers stdio、本地工作空间 skills/<name>/SKILL.md。无需修改 LXClaw 本体。LXClaw 自己选择工具、组织答案，吉政知行提供业务执行。此包的协议测试不等于 LXClaw 客户端真机测试。

## 安装（Windows / macOS）
解压全部文件到长期保留的目录。要求 Node.js 22+，无需 npm install。本地模式无服务凭证、不联网。系统终端：
```powershell
node lxclaw/install.mjs --workspace "D:\LXClaw实际工作空间"
```
workspace 必须是实际存在的活动 Agent 工作空间，而不是软件安装目录；安装包文档中的默认路径 ~/.openclaw/workspace 只是默认值，LXClaw 可能另有配置。脚本复制四个 SKILL.md 并输出 jzzx-mcp-local-tourist.json。在实际 MCP 设置页面合并片段中的 mcp.servers.jzzx，不覆盖其他插件；或者支持原生 CLI 的情况下执行 openclaw mcp set jzzx '<片段中 jzzx 的对象JSON>'。有明确且已关闭客户端的严格 JSON 配置文件时，可附加 --config "实际配置路径"，脚本备份并添加条目，拒绝冲突。禁止把完整配置贴进聊天。重启/重载智能体，运行 jzzx_status 或引擎的 openclaw mcp probe jzzx --json。若 LXClaw UI 不提供该入口而原生 CLI 未开放，需要核实客户端配置（未在 Windows 真机验证）。

## 模式
- local（默认）：景点、政务、行程和实际 HTML 文件导出。无模型费用，LXClaw 自己推理。
- demo：安装时追加 --mode demo --role tourist（或 merchant/government）。同一解压目录的 lxclaw/demo-data/jzzx-demo.sqlite 由三个身份共享，明确虚构商户与身份，实际使用与云端相同的 SQL 和业务处理函数；每个 MCP 实例固定角色。不要输入真实个人信息。切换请在不同 Agent 配置/会话中使用对应片段，或通过原生 MCP 编辑器变更服务器参数并重载。无生产写入、无伪造成功。
- cloud：--mode cloud --role tourist/merchant/government。固定访问现有移动 Worker，查询实际服务状态；聊天、业务、图片分别通过宿主环境变量 JZZX_AGENT_CODE（或 JZZX_PREVIEW_CODE）、JZZX_PORTAL_CODE、JZZX_IMAGE_CODE 授权。启动 LXClaw 的宿主进程须继承这些变量；不要把明文凭证写进 skill、MCP JSON、报告、命令历史或聊天。云端权限由服务检查，不能通过工具切角色。当前没有有效业务凭证或 D1 配置时会明确报错。生产反馈写入只生成草稿，人工终端运行 node lxclaw/approve.mjs "<草稿实际路径>" 核对并确认；该命令不提供给模型。信任宿主与操作者，不是针对有任意宿主 exec 权限的强隔离。
- 可选 --weather 直接启用 Open-Meteo（先遵守供应商使用条款）；--allow-image 仅在 cloud 模式与素材凭证存在时提供生成工具，显式确认每次费用/调用。未配置时不提供生图工具；可复用 LXClaw 自带技能（实际可用性需验证）。
- 默认云端反馈仅返回元数据，不向模型传原文，--include-feedback-text 是额外授权，仍不保证全面脱敏；请勿用于包含敏感个人数据的反馈。报告只使用汇总。
- 文档/PPT/海报自主创作由已实际可用的 LXClaw 技能提供，不冒充已生成。MCP 自己能实际生成 HTML 行程及 CSV/Markdown 统计、保存已授权模型的 JPEG。

## 现场按顺序演示
1. 本地模式：“带父母去吉林市冬天两日看雾凇，不滑雪，生成攻略文件。” 模型调用检索、选择候选ID、编排、HTML导出；再要求改为一天，保持排除条件。
2. “长春身份证到期怎么换领？” 检索政务索引、读取官方入口，需最新资料则用 LXClaw 联网能力。
3. demo 游客：“查看演示商户，向松江民宿提交设施与环境反馈：停车指引不清。” 先核对，再明确确认。记录真实返回ID。
4. demo 商户：“查看待处理反馈，分析分类，起草并确认答复，导出统计。” 使用同一数据库。
5. demo 管理人员：“汇总吉林市反馈，生成CSV和治理报告。” 回到游客身份刷新，看到真实保存的答复。演示期间明确虚构商户。
6. cloud 模式（有合法真实配置时）：检查 jzzx_status、jzzx_portal_me，使用真实授权数据库和手机/桌面端同步；缺权限时不能声称跨设备验证成功。

## 自检
```sh
node --test lxclaw/tests/*.test.mjs
```
测试从协议初始化到工具调用，经独立进程执行真实本地资料/SQL/文件导出。网络模型、LXClaw 桌面端权限及云端生产数据库须另外验收。
