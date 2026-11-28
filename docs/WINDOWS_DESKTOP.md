# 吉政知行 Windows 桌面版

桌面版使用 Electron 展示现有吉政知行官网与吉小知在线助手。它提供独立窗口、开始菜单和桌面快捷方式，但 AI 问答仍由现有 Cloudflare 服务提供，因此使用智能功能时需要联网。

## 获取 `.exe`

1. 打开 GitHub 仓库的 **Actions** 页面。
2. 选择 **Windows 桌面版** workflow。
3. 打开最新一次成功运行，在页面底部下载 `吉政知行-Windows-v…`。
4. 解压后可看到两种文件：
   - `吉政知行-安装版-0.9.0-x64.exe`：带安装向导，可选择安装目录，并创建桌面与开始菜单快捷方式。
   - `吉政知行-便携版-0.9.0-x64.exe`：无需安装，直接双击运行。

安装包目前未购买 Windows 代码签名证书。首次运行时，Windows SmartScreen 可能显示“未知发布者”；在确认文件来自本仓库的 Actions 后，可选择“更多信息 → 仍要运行”。正式对外分发前应补充代码签名。

## 本地开发

```bash
npm install
npm run desktop:start
```

Windows 本机构建：

```bash
npm ci
npm test
npm run desktop:dist
```

产物位于 `release/`。

## 行为与边界

- 应用从 `https://jizhengzhixing-official.pages.dev/` 的介绍页启动。
- 官网与吉小知正式/预览 Worker 在应用窗口内打开。
- 政府官网等第三方 HTTPS 链接由系统默认浏览器打开。
- 应用禁用网页 Node.js 权限，并开启 Electron 上下文隔离与沙箱。
- 断网或远端不可用时展示本地提示页，恢复网络后可重新连接。
- 客户端不包含 API Key、Cloudflare 凭据或离线 AI 模型。
