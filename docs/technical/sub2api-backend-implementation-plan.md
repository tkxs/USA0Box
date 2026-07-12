# SUB2API 后端对接 ZeroBox 实施方案

## 1. 目标

为 ZeroBox 提供 OAuth 2.1 Authorization Code + PKCE 登录，并提供受 scope 约束的分组、密钥和订阅接口。

当前移动端授权页返回 HTTP 400，优先检查并修复以下两项：

1. 后端是否注册了 `zerobox-android` 和 `zerobox-ios`。
2. 两个客户端是否都精确允许 `zerobox://oauth/callback`。

不能通过 `HasPrefix("zerobox://")`、通配符或关闭 `redirect_uri` 校验解决 400。授权端点和 Token 端点必须使用同一份客户端注册表进行精确校验。

## 2. ZeroBox 当前固定契约

### 2.1 Public Client 注册表

ZeroBox 是 Public Client，不配置 `client_secret`。

| client_id | 平台 | redirect_uri |
| --- | --- | --- |
| `zerobox-desktop` | Windows/macOS/Linux | `http://127.0.0.1:{动态端口}/oauth/callback` |
| `zerobox-android` | Android | `zerobox://oauth/callback` |
| `zerobox-ios` | iOS | `zerobox://oauth/callback` |

移动端 URI 必须逐字匹配，包括 scheme、host、path 和大小写。桌面端只允许：

- scheme 为 `http`
- host 为字面量 `127.0.0.1`
- 端口为 1-65535 的有效动态端口
- path 精确为 `/oauth/callback`
- 不允许 userinfo、fragment、额外路径或查询参数白名单绕过

建议定义唯一的注册表，并由 authorize、token、refresh 和 revoke 共同调用：

```go
type PublicClient struct {
    ID               string
    Platform         string
    AllowedScopes    map[string]bool
    ValidateRedirect func(string) bool
}

var publicClients = map[string]PublicClient{
    "zerobox-android": {
        ID: "zerobox-android",
        Platform: "android",
        ValidateRedirect: exactRedirect("zerobox://oauth/callback"),
    },
    "zerobox-ios": {
        ID: "zerobox-ios",
        Platform: "ios",
        ValidateRedirect: exactRedirect("zerobox://oauth/callback"),
    },
    "zerobox-desktop": {
        ID: "zerobox-desktop",
        Platform: "desktop",
        ValidateRedirect: validateZeroBoxLoopbackRedirect,
    },
}
```

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

### 2.2 授权请求

```http
GET /oauth/authorize
```

请求参数：

```text
response_type=code
client_id=zerobox-android|zerobox-ios|zerobox-desktop
redirect_uri=...
scope=...
code_challenge=...
code_challenge_method=S256
state=...
device_name=...
platform=...
```

校验顺序：

1. `response_type` 必须为 `code`。
2. `client_id` 必须存在于 Public Client 注册表。
3. `redirect_uri` 必须通过该 client 自己的精确校验器。
4. `code_challenge_method` 必须为 `S256`，拒绝 `plain`。
5. `code_challenge` 必须满足 PKCE 长度和字符集要求。
6. scope 必须是注册表允许 scope 的子集。
7. `state` 必须存在，限制最大长度。
8. `device_name` 和 `platform` 只作展示和审计，不能参与权限判断。

校验失败时返回 OAuth 标准错误。日志记录内部原因，但响应中不要泄露密钥、用户信息或完整 Token。

```json
{
  "error": "invalid_request",
  "error_description": "redirect_uri is not registered for this client"
}
```

## 3. 授权页面与登录状态

未登录用户进入 `/oauth/authorize` 时，不要丢失原授权请求，也不要把未经校验的整段 URL长期放入前端可修改状态。

推荐流程：

1. 后端完成客户端、回调、PKCE 和 scope 的初步校验。
2. 将已规范化的授权上下文写入 Redis，TTL 5 分钟。
3. 向前端返回或跳转携带不可猜测的 `request_id`。
4. 用户通过 SUB2API 原有登录流程，包括 Turnstile、密码和可选 TOTP。
5. 登录后读取 `request_id` 对应上下文，展示应用名、设备、平台和权限。
6. 用户明确允许或拒绝。

配套接口：

```http
GET  /api/v1/app-auth/authorize/context?request_id=...
POST /api/v1/app-auth/authorize/decision
```

`decision` 必须使用现有网页登录 JWT，并验证 CSRF 或同等的 Origin/SameSite 防护：

```json
{
  "request_id": "...",
  "decision": "allow"
}
```

允许后生成一次性授权码并跳转：

```text
zerobox://oauth/callback?code=一次性授权码&state=原始state
```

拒绝后跳转：

```text
zerobox://oauth/callback?error=access_denied&state=原始state
```

授权码要求：60 秒过期，只保存 SHA-256 摘要，并绑定 `user_id`、`client_id`、`redirect_uri`、scope、PKCE challenge 和授权记录 ID。

## 4. Token、刷新与撤销

### 4.1 授权码兑换

```http
POST /api/v1/app-auth/token
Content-Type: application/x-www-form-urlencoded
```

```text
grant_type=authorization_code
client_id=...
code=...
redirect_uri=...
code_verifier=...
```

后端必须再次校验：

- `client_id` 与授权码绑定值一致
- `redirect_uri` 与授权时逐字一致
- `BASE64URL(SHA256(code_verifier))` 与 challenge 常量时间比较一致
- 授权码未过期、未撤销、未使用
- Redis 使用 Lua 或事务执行原子 consume，防止并发重复兑换

### 4.2 Token 响应

该端点使用标准 OAuth JSON，不套 SUB2API `{ success, data }` 外层：

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 600,
  "scope": "profile:read groups:read keys:read keys:write subscriptions:read"
}
```

Access Token 建议 10 分钟，Refresh Token 建议 30 天。Access Token claims 至少包含：

```json
{
  "iss": "https://usa0.top",
  "aud": "sub2api-app-api",
  "sub": "用户ID",
  "token_use": "app",
  "client_id": "zerobox-android",
  "grant_id": "授权记录ID",
  "scope": ["profile:read", "groups:read"]
}
```

### 4.3 Refresh Token

```text
grant_type=refresh_token
client_id=...
refresh_token=...
```

每次刷新都轮换 Refresh Token。旧 Token 被再次使用时，撤销整个 token family 和对应设备授权。并发刷新只能有一个请求成功。

### 4.4 撤销与设备管理

```http
POST   /api/v1/app-auth/revoke
GET    /api/v1/app-auth/devices
DELETE /api/v1/app-auth/devices/:id
```

设备查询和删除使用网页登录 JWT，并且只能操作当前用户自己的授权记录。

## 5. App 专用认证中间件

新增独立 `app_jwt_auth`，不能让 App Token 直接通过现有普通用户 JWT 中间件。

`app_jwt_auth` 校验：

- JWT 签名、`iss`、`aud=sub2api-app-api` 和有效期
- `token_use=app`
- `client_id` 存在且授权未撤销
- `grant_id` 有效
- 当前路由所需 scope

同时修改现有普通 `jwtAuth`，显式拒绝 `token_use=app`。这样即使 ZeroBox Token 泄露，也不能访问管理员、支付、密码修改、身份绑定等普通用户接口。

## 6. ZeroBox 所需资源接口

以下接口继续使用 SUB2API 现有响应外层：

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

接口清单：

```http
GET  /api/v1/app/me                         scope: profile:read
GET  /api/v1/app/groups                     scope: groups:read
GET  /api/v1/app/keys?page=1&page_size=100 scope: keys:read
POST /api/v1/app/groups/:groupId/keys       scope: keys:write
GET  /api/v1/app/subscriptions              scope: subscriptions:read
```

分组至少返回：

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

创建密钥请求只接受：

```json
{
  "name": "ZeroBox"
}
```

实现要求：

- 必须复用 SUB2API 现有 Group、APIKey、Subscription service，保持密钥生成、额度、过期时间、状态和分组限制逻辑一致。
- `groupId` 只能取自 URL path，不能由 body 覆盖。
- 查询或创建密钥前验证该分组属于当前用户且允许创建。
- 密钥列表只能返回当前用户自己的记录。
- 对分页大小设置上限。
- 模型同步不新增 App Token 接口；ZeroBox 会使用用户选中的真实 API Key 请求 `GET /v1/models`。

## 7. 建议的数据与缓存结构

数据库新增 `app_authorizations`：

```text
id
user_id
client_id
device_name
platform
scopes
token_family_id
status             active|revoked
created_at
last_used_at
revoked_at
```

索引至少包括：

- `(user_id, status)`
- `token_family_id` 唯一或高选择性索引
- `(client_id, status)`

Redis 建议 key：

```text
appauth:req:{request_hash}       TTL 5 分钟
appauth:code:{code_hash}         TTL 60 秒
appauth:refresh:{token_hash}      TTL 30 天
appauth:refresh-used:{token_hash} 短期 tombstone
appauth:revoked:{grant_id}        TTL 不短于 Access Token 剩余寿命
```

Redis 中也不要保存明文授权码和 Refresh Token。

## 8. 实施顺序

### 阶段 A：修复当前移动端 400

1. 增加 Android/iOS Public Client 注册。
2. 精确允许 `zerobox://oauth/callback`。
3. 确保 `/oauth/authorize` 能识别两个 client。
4. 确保 `/api/v1/app-auth/token` 使用同一注册表。
5. 真机验证浏览器授权后可以唤起 ZeroBox。

阶段 A 仍必须保留 S256 PKCE 和一次性授权码，不能做临时的密码直登接口。

### 阶段 B：完整 App OAuth 与资源 API

1. 建立授权记录和 Redis 一次性状态。
2. 实现授权确认、Token、刷新、撤销和设备管理。
3. 实现独立 App JWT 中间件及 scope 校验。
4. 复用现有 service 暴露分组、密钥和订阅 App API。
5. 增加审计、限流和安全告警。

### 阶段 C：备用设备码

实现以下端点，作为系统浏览器无法回到 App 时的备用方式：

```http
POST /api/v1/auth/device/start
POST /api/v1/auth/device/token
POST /api/v1/auth/device/approve
```

设备码 10 分钟过期、单次兑换，批准操作必须经过网页登录、Turnstile/TOTP 等现有安全流程。当前线上这三个端点返回 404，在实现前客户端的“获取设备验证码”不可用。

### 阶段 D：HTTPS App Link / Universal Link

私有 Scheme 稳定后，再配置 Android `assetlinks.json` 和 iOS `apple-app-site-association`，并在正式签名包上验证。不要用这一阶段阻塞当前移动端登录修复。

## 9. 安全与运维要求

- 对 authorize、token、refresh、device polling 做 IP、client 和用户维度限流。
- 日志禁止记录 access token、refresh token、authorization code 和 code verifier。
- 记录授权、兑换、刷新、撤销、重用攻击和校验失败审计事件。
- 网页授权决定接口启用 CSRF/Origin/SameSite 防护。
- 所有时间比较使用服务端时间，并允许很小的时钟偏差。
- 错误响应对客户端稳定，对服务端日志详细；不要将数据库错误直接返回前端。
- 第一阶段 Token 类型必须为 `Bearer`。DPoP 需要 ZeroBox 和后端同时实现后再灰度启用。

## 10. 验收标准

必须通过以下场景：

1. Android 使用 `zerobox-android` 授权成功并返回 App。
2. iOS 使用 `zerobox-ios` 授权成功并返回 App。
3. 未注册 client、错误 redirect、`plain` PKCE、非法 scope 均被拒绝。
4. 错误 `state` 被 ZeroBox 拒绝，后端始终原样回传 state。
5. 同一个授权码只能兑换一次，并发兑换只有一个成功。
6. `client_id`、`redirect_uri` 或 verifier 任一不一致时兑换失败。
7. App Token 可访问其 scope 对应 App API，但不能进入普通用户或管理员 API。
8. 用户只能查看和创建自己分组下的密钥。
9. Refresh Token 轮换有效，旧 Token 重用会撤销整条 token family。
10. 设备撤销后 Refresh Token 立即失效，Access Token 在最长 10 分钟内失效。

建议先在预发布环境完成 Android/iOS 真机验收，再部署到 `https://usa0.top`。上线后通过服务端日志定位 400 的具体校验分支，但日志中只记录 client、错误类别和 request ID，不记录敏感参数。
