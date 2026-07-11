# Sub0Box 0.0.6

本次更新完善了应用的自动更新体验：

- 新增启动更新公告，更新内容直接读取 GitHub 最新 Release 的发布说明。
- Windows、macOS 和 Linux 点击“立即更新”后会自动下载安装包，并在下载完成后重启安装。
- Android、iOS 和 Web 端检测到新版本后，可从公告直接进入 GitHub Releases 下载页面。
- “关于”页面、侧边栏和启动公告统一使用 GitHub 最新 Release 判断版本。
- 发布流程现在要求维护 `RELEASE_NOTES.md`，每个新版本都会将其中内容写入 GitHub Release。

此次更新不会影响本地已有的会话、配置和登录数据。
