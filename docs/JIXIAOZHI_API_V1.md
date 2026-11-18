# 吉小知对话 API v1

- GET /api/v1/openapi.json：OpenAPI 3.1 契约，无需访问码。
- POST /api/v1/chat：JSON {question, history?, region?}；history 为客户端持有的成对 user/assistant 消息，最多四轮。返回 text、status、sources、可选 itinerary。
- 外部调用不带 Origin，使用独立环境密钥 AGENT_CLIENT_CODE（16–160 字符）；同源应用使用现有 TRAVEL_PREVIEW_CODE。不能将浏览器 Origin 当作身份认证，所有调用均须提供对应密钥。当前只读咨询/规划，不授予商户或政府角色权限。
- Cloudflare Worker 仍需 AI 与 LIMITER 绑定；凭证用 wrangler secret put AGENT_CLIENT_CODE --config wrangler.mobile.jsonc 设置到获准环境，不写入仓库。生产部署不在本补丁授权内。
- 独立调用：环境变量 JZZX_AGENT_URL、JZZX_AGENT_CODE，运行 node scripts/jixiaozhi-chat.mjs "吉林市一天看雾凇"。本地单元测试使用同一 Worker handler，模型接口为测试替身；真实线上和 LXClaw 客户端待授权测试。
- 工具由模型选择，真实本地景点、政务资料和确定性行程编排复用原模块。无实时联网搜索、生图、支付、政府提交或后台业务写入。partial 与 unavailable 不代表全部完成。
