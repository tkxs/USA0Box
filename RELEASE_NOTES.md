# ZeroBox 0.0.10

本次更新将 ZeroBox 正式连接到线上 SUB2API 服务：

- SUB2API 管理后台与登录地址切换到 `https://usa0.top`。
- 模型网关切换到 `https://usa0.top`，不再默认连接本机服务。
- 登录页自动读取线上站点名称“USA-零”。
- 分组、倍率、订阅和 API Key 数据均从线上账户实时获取。
- 模型同步和聊天请求继续使用用户选择的分组 API Key。
- Android 与 iOS 的 SUB2API 请求改用原生 HTTP，避免 WebView 跨域限制。
- 登录表单支持线上服务启用的 Cloudflare Turnstile 人机验证。
