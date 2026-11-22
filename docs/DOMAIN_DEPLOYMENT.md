# 吉政知行官网：Cloudflare Pages 免费部署

## 目标

先使用 Cloudflare Pages 免费子域名发布官网，不迁移或修改 `createmore.asia` 的 DNS。

- Pages 项目建议名称：`jizhengzhixing-official`
- 预期公开地址：`https://jizhengzhixing-official.pages.dev`
- GitHub 仓库：`zzq778/-`
- 生产分支：`main`
- 构建命令：`exit 0`
- 构建输出目录：`website`
- 根目录：仓库根目录（留空）

项目名称必须在 Cloudflare Pages 全局可用；若不可用，选一个新的项目名，并同步修改所有页面的 canonical、Open Graph URL、robots.txt 与 sitemap.xml。

## 创建 Pages 项目

1. 登录 Cloudflare Dashboard，进入 Workers & Pages。
2. 选择 Create application → Pages → Connect to Git。
3. 授权 GitHub，并选择 `zzq778/-` 仓库。
4. Production branch 选择 `main`。
5. Framework preset 选择 None。
6. Build command 填 `exit 0`。
7. Build output directory 填 `website`。
8. 保存并部署。

Git 集成会在 `main` 后续更新时自动重新构建部署。不要选择 Direct Upload：Direct Upload 项目之后不能直接切换为 Git integration，需要另建项目。

## 应用入口

官网的「进入吉小知」链接指向当前已部署的 Web Worker 应用：

`https://jizhengzhixing.zedi-li070614.workers.dev`

该应用与 Pages 官网独立部署。不要把官网部署到现有 `jizhengzhixing` Worker 上，也不要覆盖其生产版本。

## 搜索引擎

部署成功并确认 `pages.dev` 地址可公开访问后：

1. 打开 `https://jizhengzhixing-official.pages.dev/robots.txt`，确认允许抓取并指向 sitemap。
2. 打开 `https://jizhengzhixing-official.pages.dev/sitemap.xml`，确认页面地址均使用实际生产域名。
3. 在 Google Search Console 添加该站点并提交 sitemap。
4. 在 Bing Webmaster Tools 添加站点并提交 sitemap。
5. 百度搜索资源平台是否支持该站点类型及 sitemap 提交，以平台当时的规则为准。
6. 检查搜索平台的抓取错误、规范 URL 与收录状态。提交不保证立即收录或获得排名。

## 以后绑定 createmore.asia

当前先不改阿里云 DNS、Nameserver 或 DS 记录。

以后可在 Pages 项目的 Custom domains 中添加自定义域名。添加根域名 `createmore.asia` 时，需要该域名作为 Zone 位于创建 Pages 项目的同一个 Cloudflare 账户中；若原 Zone 属于另一个账户，应先确认账户归属和迁移方案，不能直接改 Nameserver。绑定完成后，把页面 canonical、Open Graph URL、robots.txt 与 sitemap.xml 统一更新为最终主域名。

## 发布安全边界

- 不修改现有 `jizhengzhixing` 和 `jizhengzhixing-mobile` Workers。
- 不修改阿里云 Nameserver、DNS 解析记录或 DNSSEC。
- 不要求提供 Cloudflare API Token、账户密码或其他秘密。
- 官网明确声明吉政知行为独立项目，非政府官方网站或授权政务平台。
