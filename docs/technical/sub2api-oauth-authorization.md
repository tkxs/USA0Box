# ZeroBox 与 SUB2API OAuth 2.1 对接方案

ZeroBox 使用 OAuth 2.1 Authorization Code + PKCE 作为主要登录方式。账号密码、Turnstile 和 TOTP 只在 SUB2API 网站处理，ZeroBox 永远不接触这些凭据。设备码授权保留为系统浏览器无法自动回到应用时的备用方式。

## 客户端注册

ZeroBox 是 public client，不配置也不接受 `client_secret`。

| client_id | 平台 | 允许的 redirect_uri |
| --- | --- | --- |
| `zerobox-desktop` | Windows/macOS/Linux | `http://127.0.0.1:{动态端口}/oauth/callback` |
| `zerobox-android` | Android | `https://usa0.top/app/zerobox/callback` |
| `zerobox-ios` | iOS | `https://usa0.top/app/zerobox/callback` |

桌面回调只允许字面量 `127.0.0.1`、合法端口和精确路径。拒绝 `localhost`、IPv6、`0.0.0.0`、userinfo、fragment、额外路径和任意域名。

允许的 scope：

```text
openid
profile:read
groups:read
keys:read
keys:write
subscriptions:read
offline_access
```

## 必须实现的端点

### 授权页面

```http
GET https://usa0.top/oauth/authorize
```

ZeroBox 传递标准参数：

```text
response_type=code
client_id=zerobox-desktop|zerobox-android|zerobox-ios
redirect_uri=注册的回调地址
scope=...
code_challenge=...
code_challenge_method=S256
state=...
device_name=...
platform=...
```

SUB2API 前端未登录时跳转到现有登录页，并保留完整授权请求。用户通过 Turnstile、密码和可选 TOTP 后返回授权页。授权页必须显示 ZeroBox、设备名、平台和高敏权限，用户必须显式允许或拒绝。

推荐后端先把已校验的请求存入 Redis，再把不可猜的 `request_id` 交给前端：

```http
GET  /api/v1/app-auth/authorize/context?request_id=...
POST /api/v1/app-auth/authorize/decision
```

`decision` 请求需要现有网页登录 JWT：

```json
{
  "request_id": "...",
  "decision": "allow"
}
```

允许后生成一次性 authorization code，绑定用户、client、redirect URI、scope 和 PKCE challenge，60 秒过期。拒绝时回调 `error=access_denied`，两种回调都必须携带原始 `state`。

### Token

```http
POST /api/v1/app-auth/token
Content-Type: application/x-www-form-urlencoded
```

授权码兑换：

```text
grant_type=authorization_code
client_id=...
code=...
redirect_uri=...
code_verifier=...
```

刷新：

```text
grant_type=refresh_token
client_id=...
refresh_token=...
```

成功响应使用标准 OAuth JSON，不使用 SUB2API envelope：

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 600,
  "scope": "profile:read groups:read keys:read keys:write subscriptions:read"
}
```

错误响应使用 `invalid_request`、`invalid_client`、`invalid_grant`、`invalid_scope`、`access_denied` 等标准 `error` 与可选 `error_description`。

### 撤销与设备管理

```http
POST   /api/v1/app-auth/revoke
GET    /api/v1/app-auth/devices
DELETE /api/v1/app-auth/devices/:id
```

撤销端点接受标准 `token` 和 `token_type_hint` 表单。设备列表和删除接口使用网页登录 JWT，且只能访问当前用户自己的授权。

## App 专用资源 API

App Access Token 不能进入现有普通 JWT 用户路由。新增 `app_jwt_auth` 中间件，校验 `iss`、`aud=sub2api-app-api`、`token_use=app`、`client_id`、`grant_id` 和 scope。现有 `jwtAuth` 必须显式拒绝 `token_use=app`。

ZeroBox 当前调用以下稳定契约：

这些资源端点继续使用 SUB2API 现有的 `{ success, data, message, error }` envelope；只有 OAuth token/revoke 端点使用标准 OAuth 响应。

```http
GET  /api/v1/app/me
GET  /api/v1/app/groups
GET  /api/v1/app/keys?page=1&page_size=100
POST /api/v1/app/groups/:groupId/keys
GET  /api/v1/app/subscriptions
```

创建密钥只接受：

```json
{
  "name": "ZeroBox"
}
```

服务端必须从路径写入 GroupID，不能允许 body 覆盖。所有 Key 查询必须验证 owner。分组返回至少包括：

```json
{
  "id": 1,
  "name": "default",
  "platform": "openai",
  "rate_multiplier": 1,
  "user_rate_multiplier": 1,
  "effective_rate_multiplier": 1
}
```

模型同步继续使用用户选择的真实 API Key 请求 `GET https://usa0.top/v1/models`，不使用 App Access Token。

## 后端存储与实现位置

1. 新增 Ent schema `backend/ent/schema/app_authorization.go` 和 migration。记录用户、client、设备、scope、token family、状态、创建/最近使用/撤销时间；增加 owner 和状态索引。
2. 新增 `backend/internal/service/app_auth_service.go` 和静态 public client registry。只接受 S256 PKCE，授权码 60 秒，Access Token 建议 5-10 分钟，Refresh Token 建议 30 天。
3. 新增 Redis authorization request/code cache。只存 authorization code 的 SHA-256，兑换使用 Lua 或事务原子 GET+DEL，禁止 code replay。
4. 新增 `backend/internal/handler/app_auth_handler.go`、`backend/internal/server/routes/app_auth.go`、`app_jwt_auth.go`，接入 handler/repository/service Wire 并重新生成 `backend/cmd/server/wire_gen.go`。
5. SUB2API 前端新增 `frontend/src/api/appAuth.ts`、`AppAuthorizationView.vue`、`/oauth/authorize` 路由和“已授权应用”设备管理卡片。
6. 复用现有 Group、APIKey、Subscription service 实现 App 路由，不复制业务规则。

## Refresh Token 轮换修复

SUB2API 目前会轮换 Refresh Token，但旧 token 删除后无法定位原 token family，不能真正检测重用攻击。新实现需要：

- Redis 原子 Consume，只允许一次刷新成功。
- 消费后留下短期 tombstone，记录 family ID 和 grant ID。
- 旧 token 再次出现时撤销整个 family 和设备授权。
- 并发刷新只能一个请求成功。
- 设备撤销后 Refresh Token 立即失效，Access Token 通过撤销缓存即时失效或最多存活 5-10 分钟。

## 移动端域名文件

Android 在 `https://usa0.top/.well-known/assetlinks.json` 发布正式签名证书 SHA-256：

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.tkxs.sub0box",
      "sha256_cert_fingerprints": ["正式签名证书SHA-256"]
    }
  }
]
```

iOS 在 `https://usa0.top/.well-known/apple-app-site-association` 发布：

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["APPLE_TEAM_ID.com.tkxs.sub0box"],
        "components": [{ "/": "/app/zerobox/callback" }]
      }
    ]
  }
}
```

两个文件必须 HTTPS 直出、无重定向。iOS 还需要在 Apple Developer App ID 开启 Associated Domains 并重新生成 provisioning profile。

## 安全存储

ZeroBox 已把旧 `localStorage` 会话迁移到安全存储并删除明文：

- Windows/macOS：Electron `safeStorage` 加密后写独立 store。
- Linux：如果 Electron 只能使用 `basic_text` backend，则只保留当前会话内存，不持久化令牌。
- Android：Capacitor Secure Storage / Android Keystore。
- iOS：Capacitor Secure Storage / Keychain，设置为仅本设备迁移策略。
- Web 构建：仅 `sessionStorage`，浏览器关闭后失效。

## 备用设备码

保留以下端点作为 loopback、App Link 或 Universal Link 不可用时的显式备用方案：

```http
POST /api/v1/auth/device/start
POST /api/v1/auth/device/token
POST /api/v1/auth/device/approve
```

设备码同样只能通过网站登录后批准，10 分钟过期、单次兑换、Redis 原子消费。不能增加绕过 Turnstile/TOTP 的 ZeroBox 专用密码登录接口。
设备码兑换成功后也必须签发带相同 scope 的 App Token，不能返回可进入普通用户路由的旧版通用 JWT。

## 第二阶段：DPoP 设备密钥绑定

在 OAuth/PKCE 和 scoped API 稳定后，双方同步实现 RFC 9449 DPoP：ZeroBox 为每台设备生成 P-256/ES256 不可导出私钥，授权请求绑定 JWK thumbprint；Token 带 `cnf.jkt`；Token、刷新和 App API 请求校验 `htu`、`htm`、`iat`、唯一 `jti`，资源请求额外校验 `ath`。私钥必须进入 Keychain/Keystore 或桌面系统安全存储。

当前 ZeroBox 代码尚未发送 DPoP proof，因此后端首期必须返回 `Bearer`。不能在单方强制 DPoP；应在双方实现完成后通过 feature flag 灰度启用。

## 测试清单

- PKCE verifier/challenge、state、redirect/client/scope mismatch。
- authorization code 单次消费、过期、并发兑换和 replay。
- 桌面随机端口、错误 state 不终止、取消/超时关闭 listener。
- Android/iOS 前台、后台、冷启动、拒绝授权和重复回调。
- App Token 无法访问普通用户、管理员、支付、密码和身份绑定路由。
- scope 缺失返回 403；所有 Key 接口 owner check。
- Refresh Token 并发轮换、旧 token 重用、family/设备撤销。
- App Link、Universal Link 真机验证和域名关联文件验证。
