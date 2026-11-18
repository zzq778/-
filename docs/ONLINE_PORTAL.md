# 联网文旅反馈 API（独立真实业务链路）

原有本机工作台不能视作真实身份与跨设备协作。本服务独立启用，只支持已经明确实现的反馈闭环，不替政府办理任何官方事项。

## 部署准备（仅在获准测试环境）
1. 创建 D1 数据库；把相同数据库以 PORTAL_DB 绑定到 Web 与移动 Worker。迁移目录 migrations/portal，执行 0001_feedback.sql。此仓库不假造数据库 ID，不自动创建资源或部署。
2. 用受控管理渠道录入经核实、同意加入的商户。portal_merchants(id,name,region,active) 不自带示例数据。
3. 生成不可预测的 32 字符以上凭证（如 node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"），计算 SHA256 十六进制。将角色配置 JSON 作为环境密钥 PORTAL_ACTORS。每个条目 id、role(tourist/merchant/government)、region、keyHash，merchant 另需 merchantId。凭证仅交给对应用户；管理权限必须由运营方审批。此阶段使用人工签发服务凭证，非公众注册认证。
4. 两个 Worker 使用同一授权配置及相同 D1。未配置时服务返回 503，状态接口 ready=false。

## API
- GET /api/v1/portal/status：是否配置，非数据库健康保证。
- GET /api/v1/portal/me：服务端识别角色。
- GET /api/v1/portal/merchants：游客所在地区的有效商户。
- GET /api/v1/portal/feedback：游客只读本人，商户只读本商户，管理人员只读本地区。最多最近 50 条。
- POST /api/v1/portal/feedback：游客创建 {merchantId,category,text,requestId}；同一人、同一 requestId 重试不会重复创建。
- POST /api/v1/portal/feedback/:id/replies：商户或管理人员在授权范围内写入 {text,requestId}。不允许越权读取或答复；操作方身份与时间在服务器记录。相同 idempotency key 不同请求返回 409。
- 认证头 Authorization: Bearer <独立业务凭证>；聊天预览码与外部 Agent 码无业务权限。
- 测试以 Node SQLite 实际执行 SQL 模拟 D1 binding，覆盖跨角色、跨商户、跨地区、重试、不同 Worker 共享数据。未在实际 Cloudflare D1 实测。

## 产品入口与 Agent 草稿

Web 文旅页和 Android 服务页提供联网反馈入口。凭证只保存在当前页面内存，退出清空；本机端继续可用。吉小知可将自然语言整理成结构化游客反馈草稿，用户选择本机或联网表单，编辑、选商户、确认后才执行写操作。模型不能提交，不能替代角色身份。
