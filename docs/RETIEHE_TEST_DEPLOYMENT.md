# 热铁盒国内访问测试镜像

这是从主站 `website/` 复制出来的独立测试包，**不属于正式生产站点**。

## 目标

- 使用热铁盒免费分配的二级域名测试中国大陆网络访问。
- 只部署静态官网页面、样式和品牌 SVG。
- 不绑定 `createmore.asia`，不使用付费功能。
- 不改动 Cloudflare Pages 正式官网或现有 Workers。

## 上传

在热铁盒创建一个新的测试网站，选择平台免费二级域名。将本目录中的**全部内容**上传到该网站的根目录，不能把 `retiehe-test-site` 文件夹本身再套一层。

目录包含：
- `index.html`
- `about/index.html`
- `features/index.html`
- `privacy/index.html`
- `assets/site.css`
- `assets/brand-mark.svg`
- `404.html`
- `robots.txt`
- `sitemap.xml`

## 与正式官网的差异

- 所有页面使用 `noindex,nofollow`，并且 `robots.txt` 禁止抓取，避免测试镜像被搜索引擎收录。
- Canonical 仍指向 Cloudflare Pages 正式官网。
- 首页及各页中原本跳转到 `workers.dev` 的吉小知入口改为站内「了解吉小知」功能介绍锚点，避免测试首页把访客诱导到非热铁盒托管的应用页面。
- 因此，这个镜像只测试静态官网，不代表吉小知应用已迁移或已在大陆可用。

## 验收

1. 直接访问免费二级域名，确认 HTTPS 有效。
2. 首页、关于项目、产品能力、隐私与边界页面均能打开。
3. CSS、品牌 SVG 正常加载。
4. 手机端无横向溢出。
5. 让中国大陆用户在关闭 VPN 的手机流量和校园/家庭 Wi-Fi 下分别测试。
6. 记录 DNS、TLS、首屏、页面导航和资源加载是否成功。

## 安全

- 不把热铁盒 API 密钥提交到 Git。
- 不把 API 密钥发送到聊天。
- 本测试只用静态托管，不启用云函数、数据库、付费套餐或自定义域名。
