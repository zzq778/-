# createmore.asia 域名与官网部署

## 目标结构

- `https://createmore.asia`：吉政知行项目官网，面向搜索引擎收录。
- `https://www.createmore.asia`：通过 Cloudflare Redirect Rule 301 跳转到主域名。
- `https://app.createmore.asia`：吉小知在线应用入口。
- `https://createmore.asia/app`：跳转到在线应用子域名。

官网与现有应用使用独立 Worker，避免营销页面改动影响应用 API。官网静态文件位于 `website/`，应用继续使用现有 `public/` 与 `src/worker.mjs`。

## 部署前提

1. 在 Cloudflare 中添加 `createmore.asia` 为一个 Zone。
2. Cloudflare 会给出该 Zone 专属的 Nameserver。
3. 登录域名注册商控制台，把域名 Nameserver 改为 Cloudflare 给出的值。
4. 等待 Cloudflare 将 Zone 状态变为 Active。
5. 检查原 DNS 记录是否完整导入。若域名正在用于邮箱或其他网站，必须先保留并核对 MX、TXT、A、AAAA、CNAME 等记录，不能直接清空。

## 官网部署

在仓库根目录安装依赖后，部署独立官网 Worker：

```sh
npm install
npx wrangler deploy --config wrangler.site.jsonc
```

该配置只创建/更新 `jizhengzhixing-site`，使用 `website/` 静态资源，不修改现有 `jizhengzhixing` 应用 Worker。

静态文件默认由 Cloudflare Static Assets 直接响应；只有 `/app` 与 `/app/*` 跳转路径会先执行 Worker，避免所有图片、样式和 HTML 请求都额外触发 Worker 逻辑。

部署后检查：

- `https://createmore.asia/`
- `https://createmore.asia/robots.txt`
- `https://createmore.asia/sitemap.xml`
- `https://createmore.asia/about/`
- `https://createmore.asia/features/`
- `https://createmore.asia/privacy/`
- `https://createmore.asia/app` 是否跳转到应用子域名

## www 主域名归一

`www.createmore.asia` 已作为官网 Worker 的 Custom Domain 预留。Zone 激活后，在 Cloudflare Dashboard：

1. 确认 DNS 中存在 `www` 的代理记录（橙色云朵）。
2. Rules → Redirect Rules → Create rule。
3. 条件匹配主机名 `www.createmore.asia`。
4. 目标为 `https://createmore.asia`，保留原路径和查询参数，状态码使用 301。
5. 验证 `https://www.createmore.asia/features/?from=share` 会跳转到主域名对应路径。

## 在线应用子域名

现有应用 Worker 名称为 `jizhengzhixing`。在确认当前线上应用版本、API 与多轮对话回归通过后，再到 Cloudflare Dashboard：

1. Workers & Pages → `jizhengzhixing`
2. Settings → Domains & Routes → Add → Custom Domain
3. 输入 `app.createmore.asia`
4. 等待 DNS 与证书自动配置完成

不要在尚未核对原 DNS、应用版本和必要绑定时覆盖现有 Worker。官网的“进入吉小知”按钮与 `/app` 路径均指向这个子域名。

## 搜索引擎收录

网站上线并可通过 HTTPS 正常访问后：

1. 在 Google Search Console 添加 `createmore.asia` 域名资源并完成 DNS 验证。
2. 在 Bing Webmaster Tools 添加站点并提交 `https://createmore.asia/sitemap.xml`。
3. 在百度搜索资源平台验证站点，并提交 Sitemap 或页面链接（以平台当前支持方式为准）。
4. 确保首页、关于、产品能力和隐私说明页面可被匿名访问；不要给公开页面添加登录墙或 `noindex`。
5. 定期检查搜索平台的抓取错误、规范 URL 与收录状态。提交不保证立即收录或获得排名。

## 发布边界

- 当前阶段只准备官网代码与独立部署配置；不会自动修改注册商 Nameserver、Cloudflare DNS、现有 Worker 生产版本或搜索引擎账号。
- Cloudflare Custom Domain 要求域名已在当前 Cloudflare 账户中成为 Active Zone。添加 Custom Domain 后，Cloudflare 会自动创建相应 DNS 记录并签发证书。
- 吉政知行必须在网站显著位置说明其为独立项目、非政府官方网站。不得将项目描述成政府授权平台。
- 行程内容不得承诺实时交通、票价、开放状态、预约或支付能力。
