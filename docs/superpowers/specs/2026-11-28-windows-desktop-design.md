# 吉政知行 Windows 桌面版设计

## 目标

把现有吉政知行官网与吉小知在线助手封装为可直接安装和运行的 Windows 桌面应用，保留开局介绍页、桌面端布局、在线对话与现有云端能力。

## 范围

- 使用 Electron 创建独立桌面窗口，默认打开吉政知行官网介绍页。
- 官网“进入吉小知”后仍在应用窗口中打开已部署的在线助手。
- 非吉政知行域名在系统默认浏览器中打开，避免第三方页面获得桌面容器权限。
- 网络不可用时展示本地错误页，允许用户重新进入。
- 生成 NSIS 安装版与免安装便携版 `.exe`。
- 使用 GitHub Actions 的 Windows runner 构建并上传产物，避免 Linux 交叉打包差异。

## 非目标

- 不把 Cloudflare Worker 或 AI 模型离线打包进客户端。
- 不在客户端保存 API Key、Cloudflare 凭据或生产账号信息。
- 本轮不实现自动更新、账号系统或本地模型。

## 方案比较

1. **Electron 在线壳（采用）**：完整保留现有网页行为，改动最小，可快速稳定生成 Windows 安装包；代价是体积较大，主要功能仍需联网。
2. Tauri 在线壳：体积更小，但需要 Rust、WebView2 与额外构建链，对当前以 Node 为主的仓库增加维护成本。
3. 直接把 PWA 当桌面快捷方式：最轻，但无法交付独立 `.exe`，也不具备受控导航与本地断网页。

## 安全与行为

- `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。
- 应用内只允许 `jizhengzhixing-official.pages.dev`、`jizhengzhixing-mobile-preview.zedi-li070614.workers.dev` 与正式 Worker 域名。
- 其他 HTTPS 链接交给系统浏览器；非 HTTPS 导航直接拒绝。
- 桌面窗口默认 1440×900，最小 1024×700，Windows 菜单栏隐藏。

## 验收

- 配置单测覆盖可信域名、欺骗性子域名、HTTP 与非 URL 输入。
- 仓库全部 `npm test` 通过。
- Windows workflow 能执行 `npm run desktop:dist` 并上传两种 `.exe`。
- 桌面入口、安装配置、离线页和使用说明随仓库提交。
