# ZeroBox 0.1.1

本次更新重点修复手机端安全登录、异形屏布局和 Android 更新体验。

## 手机端安全登录

- Android 与 iOS 的 OAuth 回调改用 `zerobox://oauth/callback`，授权完成后直接返回 ZeroBox。
- 不再依赖尚未正确部署的 App Links/Universal Links，避免授权后停留在“页面未找到”。
- 继续使用 OAuth 2.1 Authorization Code + PKCE、随机 `state` 和一次性授权码保护登录。
- 保留 `https://usa0.top/app/zerobox/callback` 兼容能力，便于后续重新启用经过域名验证的链接。

SUB2API 必须为 `zerobox-android` 和 `zerobox-ios` 精确允许 `zerobox://oauth/callback`，并在授权码兑换时校验相同的 `redirect_uri`。

## 刘海与挖孔屏适配

- Android 现在与 iOS 一样初始化原生安全区插件。
- 顶部安全距离同时参考屏幕安全区和系统状态栏高度。
- 修复部分挖孔屏手机顶部栏被遮挡、按钮无法点击的问题。
- 键盘弹出和收起时自动恢复底部安全区域。

## Android 应用内更新

- Android 检测到新版本后可直接在 ZeroBox 内下载安装包，不再跳转 GitHub Release 页面。
- 下载过程显示实时进度，完成后打开 Android 系统安装确认页面。
- 首次使用时会引导用户允许 ZeroBox 安装未知来源应用。
- 更新器只接受 ZeroBox 官方仓库的固定 HTTPS 下载地址和受限 APK 文件名。
- GitHub Release 新增固定自动更新资产 `ZeroBox-android-update.apk`。
- 同时发布带版本号的正式 APK、AAB 和测试 APK，便于人工下载和渠道分发。

## Android 签名说明

- 自动更新 APK 现在必须使用长期固定的正式签名证书。
- GitHub Actions 缺少签名 Secrets 时会停止 Android 发布，避免产生无法覆盖安装的临时包。
- ZeroBox 0.1.0 的 Android 包使用临时 Debug 签名，无法直接覆盖安装 0.1.1 的正式签名包。Android 用户需要手动卸载 0.1.0 并安装一次 0.1.1；从 0.1.1 开始即可使用应用内更新。

## iOS 更新说明

iOS 不允许普通应用下载 IPA 后自行覆盖安装。iOS 后续更新应通过 App Store、TestFlight 或合规企业分发渠道完成。
