# ZeroBox 0.1.0

本次更新重构了 ZeroBox 与 SUB2API 的登录和授权体系，重点提升桌面端与移动端的安全性、稳定性和账号控制能力。

## 安全登录

- 登录流程升级为 OAuth 2.1 Authorization Code + PKCE。
- ZeroBox 不再直接接收或提交用户密码、Turnstile Token 和 TOTP 验证码。
- 登录、Cloudflare Turnstile 和两步验证统一在 `usa0.top` 网站完成。
- 桌面端通过系统浏览器授权，并使用随机 `127.0.0.1` 回调端口接收一次性授权码。
- 严格校验 PKCE、`state`、回调地址、端口、路径和授权有效期，防止授权码截获、重放和回调伪造。
- 系统浏览器无法自动返回应用时，可以改用设备验证码完成登录。

## Android 与 iOS

- Android 新增经过域名验证的 App Links 回调。
- iOS 新增 Universal Links 和 Associated Domains 配置。
- 支持应用在前台、后台或冷启动状态下恢复授权回调。
- 增加 `zerobox://` 回调作为兼容兜底，但主要流程仍使用经过验证的 HTTPS 链接。

## 凭据保护

- SUB2API Access Token 和 Refresh Token 不再明文保存在浏览器 `localStorage`。
- Windows 与 macOS 使用 Electron 系统安全存储加密会话。
- Android 使用系统 Keystore，iOS 使用 Keychain。
- 自动迁移并删除旧版本留下的明文登录会话。
- 不具备安全凭据后端的环境只保留当前会话，不将令牌长期写入磁盘。

## 权限与 API

- ZeroBox 改用独立的 scoped App Token，不再使用可访问全部用户接口的通用登录令牌。
- 权限细分为个人资料、模型分组、API Key 和订阅读取等范围。
- 分组、倍率、分组密钥和订阅继续从 SUB2API 实时同步。
- 创建 API Key 时由服务端强制绑定目标分组，避免客户端覆盖分组归属。
- 模型同步和聊天请求继续使用用户选中的分组 API Key。
- Refresh Token 使用 OAuth 端点轮换，支持设备级撤销和后续重用检测。

## 服务端兼容要求

ZeroBox 0.1.0 需要 SUB2API 同时部署新的 OAuth 与 App API：

- `/oauth/authorize`
- `/api/v1/app-auth/token`
- `/api/v1/app-auth/revoke`
- `/api/v1/app/*`
- 备用设备授权接口 `/api/v1/auth/device/*`

如果 SUB2API 尚未部署这些接口，请在服务端升级完成前继续使用 ZeroBox 0.0.10。

完整服务端接口、安全约束、移动端域名文件和测试要求见随源码发布的 `docs/technical/sub2api-oauth-authorization.md`。
