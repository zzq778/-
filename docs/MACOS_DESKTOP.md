# macOS 桌面端

使用原生 AppKit 窗口及系统 WKWebView，共享 Windows 宽屏样式和移动端业务资源。Universal .app 同时包含 Apple Silicon arm64、Intel x86_64，最低 macOS 12。打包资源离线可用；独立 API 桥接只访问现有移动 Worker 的已列出业务路径，拒绝任意远程页面、重定向及外部请求，不保存访问码。PNG、JPEG、CSV 通过系统保存窗口。朗读依赖系统 WebKit 支持，尚未验收。

构建：macOS 上安装 Xcode Command Line Tools、Node 22、Python 3，执行 bash desktop/macos/build.sh，产物 dist/JiZhengZhiXing-macOS-universal.zip。当前使用 ad-hoc 本机签名，无 Apple Developer ID 或公证；下载后 Gatekeeper 可能拦截，正式发布需合法签名公证。不要关闭全局安全保护。CI 原生启动测试覆盖离线规划和保存；实际手机/电脑与线上接口仍需真实验收。
