# LXClaw 适配基线
安装包版本 1.19.15，内置 mcp.md 609–655 行给出 mcp.servers stdio 格式，422–449 行给出 CLI 操作，skills.md 39–50、235–250 行给出工作空间技能路径及 frontmatter 格式。以实际随包文档为准，不假设 LXClaw 的外壳一定暴露所有上游命令。

架构：LXClaw → 本机 stdio MCP（无 npm 依赖，Node22）→ 既有源码 / 可选 Cloudflare API。四套 SKILL.md。离线直接调用共享约束校验、真实景点/政务索引；不依赖另一 LLM。演示数据库以 Node SQLite 执行正式 SQL 迁移及 portal handler，固定身份、持久化、幂等写入。云端配置仅按现有 API 使用，默认无真实写入或额外付费。请查看 lxclaw/README.md 及回归结果。未验证客户端安装或云端生产身份，不能称完整验收。
