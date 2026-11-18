# Android 真机验证与导出
- 应用打包的是本地受信任 HTML，第三方链接交由系统浏览器。新增的原生接口仅允许 PNG、JPEG 或 CSV 的限长导出，并通过 Android ACTION_CREATE_DOCUMENT 由用户决定保存位置；不读取任意文件或暴露设备凭证。外部子框架不加载，允许本机 srcdoc。
- 朗读使用 Android TextToSpeech 的简体中文语种，语音包不可用时告知用户；返回、退出页面停止朗读。真实声音和系统文件保存尚需真机验证。
- 版本号 1.0.0-preview（versionCode 17）。默认构建仍使用临时测试签名，不能保证覆盖安装之前不同签名的 APK。若团队配置受控预览密钥，构建脚本支持 ANDROID_PREVIEW_KEYSTORE_B64、ANDROID_PREVIEW_ALIAS、ANDROID_PREVIEW_STOREPASS、ANDROID_PREVIEW_KEYPASS。不要提交密钥。正式发布签名及生产发布需另外授权。
