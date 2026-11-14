# 吉政知行｜三人 GitHub 协作约定

## 1. 开通权限（由仓库所有者操作）

仓库：`https://github.com/zzq778/-`（私有）。浏览器访问仓库 → Settings → Collaborators → Add people，依次邀请两位队友 GitHub 用户名；队友各自接受邀请。

**注意**：个人私有仓库的 Collaborator 可直接向仓库推送代码，不能只给只读权限。在 GitHub Free 的个人私有仓库上，不能假设已启用强制 PR 审核的分支保护。实际风险控制靠三人约定不直接改 `main`，合并由仓库所有者负责。

## 2. 分工与目录

| 人员 | 分支（建议） | 主要目录 | 交付责任 |
|---|---|---|---|
| 你与 ChatGPT | `feature/ui` | `public/` | UI、动画、Android 体验、前端交互 |
| 同学 A | `feature/ai` | `src/`、`tests/` | Cloudflare、模型调用、附件、后端测试 |
| 同学 B | `feature/content` | `src/knowledge.mjs`、`docs/` | 官方政务来源核对、知识资料和验收场景 |

注意：`src/knowledge.mjs` 与 `src/worker.mjs` 的接口变动应提前通知另一人，避免合并时相互覆盖。团队成员可以使用 DeepSeek 辅助开发，但最终提交者要读懂代码、运行测试，并对修改负责。

## 3. 每人工作流程

在个人 Codespaces 或本地终端，首次克隆后：

```bash
git switch main
git pull origin main
git switch -c feature/ai  # 各自替换成自己的分支名称
```

完成改动后：

```bash
npm test
git add src tests           # 仅提交自己实际改动的文件，示例为 AI 组
git commit -m "Add large-file upload tests"
git push -u origin feature/ai
```

打开 GitHub 仓库 → **Pull requests → New pull request**，比较 `feature/ai` 与 `main`，写清改动文件、测试情况、是否影响部署。另一位队员或仓库所有者检查后合并。完成一轮后先更新 `main`，再开新任务分支，避免长期分支冲突。

若暂时只用手机，在 Codespaces 底部终端执行这些命令即可；GitHub 网页也可以创建 PR 和接受邀请。

## 4. 三条硬规则

1. **不向 `main` 直接推送未验收代码**：`main` 当前连接 Cloudflare 自动部署。
2. **不向 GitHub 提交密钥/用户材料**：`DEEPSEEK_API_KEY`、`UPLOAD_SIGNING_KEY`、身份证照片和真实办事材料不能上传；`.dev.vars`、`.env*` 已被忽略。
3. **不为凑功能加入复杂架构**：本项目只有一个 Worker 后端，任何新功能都应能说明业务收益、文件变化和测试结果。

## 5. PR 描述模板

```md
### 改动目的
简述解决的问题。

### 修改文件
- xxx

### 验证结果
- npm test：通过/失败
- 手机测试：实际运行/尚未验证

### 风险与部署配置
是否涉及模型费用、密钥、R2、云端服务配置。
```
