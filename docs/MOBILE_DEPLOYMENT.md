# 联网移动端部署

- Worker: `jizhengzhixing-mobile`，生产分支 `feat/wenlv-product-v1`。
- 仓库根目录 `/`，部署命令 `npx wrangler deploy --config wrangler.mobile.jsonc`。
- 运行时 Settings > Variables and Secrets 添加 Secret `TRAVEL_PREVIEW_CODE`，使用随机 16–160 字符访问码，不提交仓库或构建日志。
- 配置自动声明 AI 及 LIMITER；部署后访问 `/api/status` 验证版本及 ready 状态。`ready:true` 仅说明绑定和访问码已配置，不代表真实模型调用已通过。
- 使用手机访问部署网址，输入团队访问码并生成行程。核对模型选择的实际工具执行记录及非降级状态。任何调用失败应明确标识，不冒充已完成云端推理。
- 独立移动 Worker 不覆盖原项目；禁止修改 main 的 Wrangler 配置来满足此 Worker 的名称要求。
