# 吉政知行 Windows Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可由 Windows runner 构建的吉政知行 NSIS 安装版与便携版 `.exe`。

**Architecture:** Electron 仅负责安全窗口、导航边界与断网页，业务界面和 AI 能力继续由现有 Cloudflare 部署提供。桌面配置拆成无 Electron 依赖的纯模块，便于用仓库现有 `node:test` 直接验证。

**Tech Stack:** Node.js ESM、Electron 45.5.0、electron-builder 26.18.0、GitHub Actions Windows runner

**Spec:** `docs/superpowers/specs/2026-11-28-windows-desktop-design.md`

## Global Constraints

- 不在客户端保存任何 API Key 或 Cloudflare 凭据。
- `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。
- 只在桌面窗口中保留吉政知行官方 Pages 与 Worker 域名。
- 不修改现有官网和移动端业务逻辑。

## Review Focus

- 伪装成可信域名的后缀或子域名必须被拒绝。
- HTTP、脚本协议与格式错误的 URL 必须被拒绝。
- 官网跳转在线助手时必须留在应用窗口。
- 外部 HTTPS 链接必须交给系统浏览器。
- Windows 产物名称必须能区分安装版与便携版。

---

### Task 1: 桌面配置与导航边界

**Files:**
- Create: `desktop/config.mjs`
- Test: `tests/desktop-config.test.mjs`

**Interfaces:**
- Produces: `APP_URL: string`、`isTrustedAppUrl(rawUrl: string): boolean`

- [ ] **Step 1:** 先写可信站点、正式/预览 Worker、欺骗域名、HTTP 和非法字符串的失败测试。
- [ ] **Step 2:** 运行 `node --test tests/desktop-config.test.mjs`，确认因模块不存在而失败。
- [ ] **Step 3:** 实现常量与严格的 URL 协议/hostname 判断。
- [ ] **Step 4:** 重跑桌面配置测试并确认通过。

### Task 2: Electron 窗口与断网页

**Files:**
- Create: `desktop/main.mjs`
- Create: `desktop/offline.html`
- Modify: `package.json`

**Interfaces:**
- Consumes: `APP_URL`、`isTrustedAppUrl()`
- Produces: Electron 应用入口和 `desktop:start` / `desktop:dist` 命令

- [ ] **Step 1:** 配置安全 BrowserWindow、单实例行为、受控导航与外链系统打开。
- [ ] **Step 2:** 添加加载失败时使用的本地离线页。
- [ ] **Step 3:** 添加固定版本依赖和 electron-builder 的 Windows NSIS/portable 配置。
- [ ] **Step 4:** 运行 `npm test`，确认全部单测通过。

### Task 3: Windows 构建与交付说明

**Files:**
- Create: `.github/workflows/windows-desktop.yml`
- Create: `docs/WINDOWS_DESKTOP.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `npm run desktop:dist`
- Produces: GitHub Actions 中可下载的 Windows `.exe` artifact

- [ ] **Step 1:** 添加 `windows-latest` 手动/分支构建流程与 artifact 上传。
- [ ] **Step 2:** 记录本地启动、云端打包、产物区别和联网边界。
- [ ] **Step 3:** 忽略 `node_modules/` 与 `release/`。
- [ ] **Step 4:** 安装依赖并执行完整测试与 Windows 打包配置检查。
- [ ] **Step 5:** 提交并推送 `feat/windows-desktop` 分支，观察 workflow 产物。
