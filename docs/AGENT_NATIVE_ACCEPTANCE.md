# Agent 原生版本验收记录（阶段性）

## 代码与验证

- 统一分支 feat/agent-native-product，PR #11，保留 main 与团队原分支。已合并的团队功能基线见 TEAM_FEATURE_PARITY.md、PR #10。
- 对话为 Web 与 Android 首页主要入口；共用 product-agent.mjs；原行程、政务清单、附件和独立工作台保留。
- 本地真实 HTTP + SQLite 测试由 tests/product_http_fixture.mjs 和 tests/browser_product_http.py 执行。测试模型为隔离替身；禁止将其当成线上模型验证。
- 测试覆盖独立 CLI 接入、跨角色反馈、越权拒绝、草稿确认、图片真实浏览器解码及下载。在 320/390/820px 渲染实际页面并保存截图；CI 可下载 product-quality-screenshots。
- 统计由授权数据库查询产生；模型仅访问聚合分类，不能读取原始反馈、身份或凭证，无其他工具和写权限。
- Android 预览包可构建；原生语音、PNG/JPEG/CSV 系统保存新增实现，真机仍未完成。暂不将预览包作为正式发布。
- 复现：Node 22，npm run build:mobile && npm test；Python 安装 playwright 并执行 python -m playwright install chromium，再运行 python tests/browser_mobile_product.py、python tests/browser_workspaces.py、python tests/browser_web_product.py、python tests/browser_product_http.py。
- 当前阶段自动化验证不代替真机、上线凭证与真实第三方服务验收；以最新提交对应 CI 状态为准。

## 阻塞与解锁条件

- Cloudflare 连接仅能读取，D1 列举权限不足；没有创建数据库、签发真实角色、部署 Worker 或写入生产数据。需要获准测试环境的部署权限与数据库绑定。见 ONLINE_PORTAL.md。
- Weather、Brave Search、图片服务适配已实现，默认未配置。真实网络和模型调用需要有效服务配置及费用/使用条款授权。见 JIXIAOZHI_API_V1.md。
- REST + OpenAPI 及独立 CLI 已验证；LXClaw 专有接口、指定版本与真实客户端未核实。见 LXCLAW_INTEGRATION.md。
- 原有商户档案、证件、审批等本机功能保持原行为；不宣称已经具备真实政务审批、真实身份注册或全量跨端同步。
- UI 实际渲染已检查，但仍需真实用户/设备验证，尤其大字模式、系统语音与文档选择器。参见 ANDROID_NATIVE_ACCEPTANCE.md。
- 按现有统一产品发布门槛，在上述关键真机验证完成前保留待审查分支，不覆盖 main，不生产发布。
