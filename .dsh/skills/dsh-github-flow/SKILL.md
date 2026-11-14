---
name: dsh-github-flow
description: 在 zzq778/-（吉政知行 AI 接入 demo）完成一次代码改动的标准流程：同步 main → 开分支 → 改代码 → 本地验证 → 提 PR → 在 PR 总览发评论。当用户说「改这个仓库的 X」「修一下 Y」「提个 PR」时使用。
---
# 改代码 → 提 PR → 发评论

目标仓库 `zzq778/-`（私有，基分支 `main`）。`gh` 已登录并对该仓库有 WRITE 权限，无需 fork。

## 1. 同步

```bash
git fetch origin && git switch main && git pull --ff-only
```

工作区不干净时先问用户，不要 `reset --hard` 掉别人的改动。

## 2. 开分支

`fix/<短英文描述>` 或 `feat/<短英文描述>`，例如 `fix/glm-empty-retry`。

## 3. 改代码

- 先读再改，只动必要文件；严格范围，不顺手重构无关代码。
- 改完后自查：新增分支是否覆盖了空值、错误、超时路径。
- `AGENTS.md` 里的约定优先级高于本技能。

## 4. 验证（不可跳过）

```bash
npm test                        # 必须；纯 clone 可跑，无需 npm install
python3 tests/browser_flow.py   # 动到 public/ 时；需先 npm run dev
```

测试没覆盖的路径，写一次性验证脚本跑通并**在报告里附证据**，脚本不要提交。

## 5. 提交

约定式提交，正文包含：根因、改法、验证命令与结果。

```bash
git add -A && git commit -F - <<'EOF'
fix(scope): 一句话
根因：…
改法：…
验证：…
EOF
```

## 6. 提 PR

```bash
gh pr create -R zzq778/- --base main --head <branch> \
  --title "<type>(scope): 一句话" --body-file /tmp/pr-body.md
```

PR 正文结构：**现象 / 根因 / 改动 / 验证 / 风险与未做**。验证部分给命令和结果，不要只说「已测试」。

## 7. 在 PR 总览发评论

```bash
gh pr comment <number> -R zzq778/- --body-file /tmp/pr-comment.md
```

评论是给 reviewer 看的，不要重复 PR 正文：
- 变更摘要表（文件 → 改了什么 → 为什么）
- 验证证据（关键断言，尤其「改前会失败、改后通过」的那条）
- 风险取舍（为什么这样选，另一种做法为什么没选）
- 合入前 checklist
- 仍未解决 / 需要用户确认的事项

## 8. 回报

给用户：PR 链接、改了哪些文件、验证结论、待确认项。不要只说「已完成」。

## 硬性约束

- 不直推 `main`；不 force push；不自行 merge PR。
- 不执行 `npm run deploy` / `wrangler deploy`，除非当轮明确要求。
- 失败要如实报告失败输出，不要声称「应该没问题」。
