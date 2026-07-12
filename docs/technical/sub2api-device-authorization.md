# SUB2API device authorization for ZeroBox

ZeroBox does not submit a user's email, password, TOTP code, or Turnstile token. It opens the SUB2API website so the existing website login flow performs those checks, then polls for a one-time device authorization result.

## API contract

All endpoints use the existing SUB2API response envelope.

### Start authorization

`POST /api/v1/auth/device/start` is public and rate limited.

Request:

```json
{
  "client_name": "ZeroBox"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "device_code": "a-high-entropy-private-value",
    "user_code": "ABCD-EFGH",
    "verification_uri": "https://usa0.top/device",
    "verification_uri_complete": "https://usa0.top/device?code=ABCD-EFGH",
    "expires_in": 600,
    "interval": 3
  }
}
```

`device_code` must contain at least 256 bits of randomness. `user_code` is only an identifier for approval and must never be accepted by the token endpoint.

### Poll authorization

`POST /api/v1/auth/device/token` is public and rate limited with enough capacity for one request every three seconds.

Request:

```json
{
  "device_code": "a-high-entropy-private-value"
}
```

While waiting, return HTTP 202:

```json
{
  "success": true,
  "data": {
    "status": "authorization_pending"
  }
}
```

The other non-success terminal states are `access_denied` and `expired_token`. The optional `slow_down` state asks ZeroBox to add five seconds to its polling interval. They may be returned in `data.status`, or as the existing error envelope's `error.code`.

After approval, return the same token and user fields as the existing login endpoint:

```json
{
  "success": true,
  "data": {
    "status": "approved",
    "access_token": "...",
    "refresh_token": "...",
    "expires_in": 3600,
    "token_type": "Bearer",
    "user": {}
  }
}
```

The approved device code is single-use. Only one poll request may receive the token pair.

### Approve or deny

`POST /api/v1/auth/device/approve` requires the normal JWT authentication middleware.

Request:

```json
{
  "user_code": "ABCD-EFGH",
  "action": "approve"
}
```

`action` is either `approve` or `deny`. Approval stores the authenticated user's ID against the device request. It must not accept a user ID from the request body.

## SUB2API implementation locations

1. Add a Redis-backed device authorization cache under `backend/internal/repository`. Store a hashed device code, normalized user code, client name, status, and approved user ID with a ten-minute TTL. Add an atomic claim operation for token exchange.
2. Add the service operations under `backend/internal/service`. Generate codes with `crypto/rand`; never use `math/rand`. On an approved atomic claim, load the active user and call the existing `AuthService.GenerateTokenPair`.
3. Add handlers under `backend/internal/handler`, following the response envelope used by `auth_handler.go`.
4. Register `device/start` and `device/token` as public rate-limited routes in `backend/internal/server/routes/auth.go`. Register `device/approve` in its authenticated route group.
5. Wire the new cache/service through `backend/cmd/server/wire.go`, then regenerate `wire_gen.go` with the project's Wire command.
6. Add `frontend/src/api/deviceAuth.ts`, a `/device` route, and an authorization view. If the visitor is signed out, preserve the user code through login and return to `/device`; if signed in, show the client name and an explicit approve/deny choice.

## Security requirements

- Keep Turnstile and TOTP in the existing website login flow.
- Never embed a fixed client secret in ZeroBox.
- Never put `device_code` in a browser URL or log it.
- Bind approval to the authenticated website user and show an explicit confirmation.
- Expire all records after ten minutes and delete them immediately after a successful exchange.
- Rate limit start, poll, and approval independently. Reject polling faster than the advertised interval or return `slow_down`.
- Test expiry, denial, duplicate approval, concurrent token polls, disabled users, backend mode, Redis failure, and refresh-token creation.
