# Sub0Box 发布说明

## 发布前提

- `tkxs/USA0Box` 必须是公开仓库，否则客户端无法匿名下载 Release 更新文件。
- Windows 和 macOS 安装包当前未签名，系统可能在首次运行时显示安全警告。
- Android 未配置签名时只生成测试用 Debug APK；iOS 未配置 Apple 证书时只验证模拟器构建，不生成 IPA。

## 发布新版本

1. 同时修改根目录 `package.json` 和 `release/app/package.json` 中的 `version`，两个版本必须一致。
2. 在 `release/app` 目录运行 `npm install --package-lock-only --ignore-scripts`，同步 `package-lock.json`。
3. 提交并推送代码。
4. 创建与版本号一致的 Git 标签，例如版本 `0.0.2` 对应标签 `v0.0.2`。

```powershell
git add .
git commit -m "Release v0.0.2"
git push origin main
git tag v0.0.2
git push origin v0.0.2
```

推送标签后，`.github/workflows/release.yml` 会构建 Windows、macOS、Linux 和 Android 安装包，验证 iOS 工程，并自动上传可发布文件到对应的 GitHub Release。

## Android 正式签名

使用 `keytool` 创建并妥善备份 keystore。同一个应用的所有后续版本必须继续使用同一份密钥，否则 Android 不允许覆盖升级。

在 GitHub 仓库的 `Settings > Secrets and variables > Actions` 中配置：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

可以在 PowerShell 中将 keystore 转换为 Base64：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('sub0box-release.jks')) | Set-Clipboard
```

Secrets 完整时，Release 会包含签名后的 `Sub0Box-<版本>-android.apk` 和用于 Google Play 的 `Sub0Box-<版本>-android.aab`。没有 Secrets 时只包含不能用于正式持续升级的 `android-debug.apk`。

## iOS 正式发布

当前 Actions 在 macOS Runner 上完成无签名模拟器编译。要生成 IPA 并上传 TestFlight，还需要 Apple Developer 账号、`com.tkxs.sub0box` App ID、Distribution 证书、Provisioning Profile 和 App Store Connect API Key。

## 自动更新文件

不要从 Release 中删除 `latest.yml`、安装包或 `.blockmap` 文件。Sub0Box 的桌面自动更新功能需要这些文件判断版本并下载安装包。
