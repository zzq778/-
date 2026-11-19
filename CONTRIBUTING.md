# 贡献指南 / Contributing

欢迎提交可复现的缺陷报告、文旅资料纠错、测试和小范围改进。项目以中文协作为主，英文问题也可以提交。

## 开发流程

1. 从最新 `main` 创建 `fix/…` 或 `feat/…` 分支；外部贡献者在拥有相应权利并遵守仓库许可边界的前提下提交修改建议。
2. 先阅读 [AGENTS.md](AGENTS.md) 和 [README.md](README.md)，确认真实接口与功能边界。涉及他人负责的模块时先沟通。
3. 控制改动范围；增加功能时补对应回归测试，不重复实现已有模块。
4. 使用 Node.js 22 执行：

```bash
npm run build:mobile
npm test
```

涉及前端需按模块选择浏览器流程测试；移动端主要使用 `tests/browser_mobile_product.py`、`tests/browser_workspaces.py`、`tests/browser_web_product.py`（需 Python、Playwright、Chromium）。涉及真实模型或设备的验证应另行记录，不用 mock 结果代替。

5. 提交信息使用 `fix|feat|chore|docs|test(scope): 说明`；PR 写清改动原因、测试输出、风险及未验证事项。不得直接推送 main 或自行部署。

## 资料与安全

- 旅游与政务资料必须附原始官方来源、适用地区及核对日期；不确定的费用、开放时间、办理条件不推测。
- 不提交账号凭据、实际访问码、真实身份材料、含个人信息的截图与日志。
- 安全漏洞请按 [SECURITY.md](SECURITY.md) 私下报告，不在普通 Issue 中公开利用细节。
- 当前仓库尚无统一许可证。提交代码或外部素材前确保你拥有相应权利；不要擅自替其他贡献者授权。

普通问题请附复现步骤、预期结果、实际结果、环境及脱敏截图。没有运行过的测试应明确标记未运行。
