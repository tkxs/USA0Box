# Sub0Box 0.0.7

本次更新修复了启动公告来源不一致的问题：

- 移除启动时对旧 Chatbox 远程公告接口的请求，不再显示“请升级到 Chatbox 1.2.2”。
- 启动更新公告现在只读取 Sub0Box GitHub 最新 Release 的发布说明。
- 保留桌面端自动下载安装能力，下载完成后可直接重启安装。
- Android、iOS 和 Web 端继续通过 GitHub Releases 获取最新版。

此次更新不会影响本地已有的会话、配置和登录数据。
