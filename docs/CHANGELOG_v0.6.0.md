# v0.6.0 相对 v0.5.4 的修改

- 新增：`public/home-v060.css`（首页设计独立样式，避免波及其它功能页）
- 新增：`public/assets/changchun-people.webp`、`changchun-skyline.webp`、`jixiaozhi-robot.webp`、`city-news.webp`（设计图拆分并压缩）
- 修改：`public/app.js` 首页布局、快捷提问，以及云端请求附带受限页面上下文
- 修改：`src/worker.mjs` 白名单过滤 `context.tab`/`context.guide` 后加入系统提示词
- 修改：`tests/worker.test.mjs` 新增页面上下文白名单测试
- 修改：`public/index.html` 增加首页样式引用
- 修改：`public/sw.js` 更新资源清单与缓存版本
- 修改：`public/manifest.webmanifest` 清理过程性说明
- 修改：`package.json` 版本 0.6.0

没有新增系统级权限，不修改 AI 模型、速率限制、服务端安全策略、官方链接白名单。
