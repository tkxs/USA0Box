# ZeroBox 0.1.2

本次更新完成 ZeroBox 与新版 SUB2API 的安全登录对接，并修复手机端图标显示问题。

## SUB2API 安全登录

- Android 与 iOS 使用各自注册的 OAuth Public Client，通过 `zerobox://oauth/callback` 在授权完成后直接返回 ZeroBox。
- 登录继续使用 OAuth 2.1 Authorization Code + S256 PKCE、随机 `state` 和一次性授权码。
- 已适配 SUB2API 新的标准 OAuth Token 响应和 App 专用访问令牌。
- 兼容 SUB2API 当前 `{ code, message, data }` 与 App API `{ success, data }` 两种响应格式。
- 移除线上尚未部署、会返回 404 的“设备验证码登录”入口，统一使用网站安全授权。
- 密码、Turnstile 和身份验证码始终只提交到 SUB2API 网站，ZeroBox 不接触用户密码。

## 模型分组与密钥

- 模型分组优先显示 SUB2API 返回的实际生效倍率 `effective_rate_multiplier`。
- 未返回实际倍率时，自动兼容用户倍率和基础倍率。
- 快速创建 API Key 页面同步显示实际生效倍率。
- 模型同步继续使用用户为对应分组选择的真实 API Key 请求上游模型列表。

## 手机端图标

- 修复 Android 桌面图标出现黑色背景的问题。
- Android 传统图标使用透明画布，自适应图标使用透明前景和标准背景。
- iOS 图标使用符合 App Store 要求的不透明背景，避免 Alpha 通道导致构建或审核问题。
- 新增统一的手机图标生成脚本，Android 与 iOS 资源可以稳定重复生成。

## 后端契约

- 新增 SUB2API 后端对接实施文档，记录客户端注册、回调校验、Token、刷新、撤销、scope 和 App API 契约。
- ZeroBox 当前使用 `zerobox-desktop`、`zerobox-android` 和 `zerobox-ios` 三个 Public Client，不使用 `client_secret`。

## 更新说明

- Android 用户可通过 ZeroBox 应用内更新下载并安装 `ZeroBox-android-update.apk`。
- iOS 更新仍需通过 App Store、TestFlight 或合规企业分发渠道完成。
