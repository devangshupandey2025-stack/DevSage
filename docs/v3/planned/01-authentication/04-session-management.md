# Session Management

> `apps/api/src/routes/auth.ts` + `apps/api/src/lib/cookies.ts` — Cookie configuration, logout, session listing, and token refresh.

## Cookie Configuration

### `setAccessTokenCookie(c, token)`

```ts
{
  name: 'access_token',
  value: token,
  httpOnly: true,
  secure: isHTTPS,
  sameSite: determineSameSite(origin), // Lax | None | Strict
  path: '/',
  maxAge: JWT_EXPIRY_SECONDS,          // 900 (15 min)
}
```

### `setRefreshTokenCookie(c, token)`

```ts
{
  name: REFRESH_TOKEN_COOKIE_NAME,
  value: token,
  httpOnly: true,
  secure: isHTTPS,
  sameSite: determineSameSite(origin),
  path: '/auth/refresh',              // only sent to refresh endpoint
  maxAge: REFRESH_TOKEN_EXPIRY_SECONDS, // 2592000 (30 days)
}
```

### SameSite Logic

```ts
function determineSameSite(origin: string): 'Lax' | 'None' | 'Strict' {
  if (origin.includes('.workers.dev')) return 'None'; // dev environment
  if (isSecure && !isCrossSite) return 'Strict';
  return 'Lax'; // default
}
```

## Endpoints

### `POST /auth/refresh`

Rotates refresh token and issues new access token.

**Request:** No body. Refresh token read from `refresh_token` cookie.

**Response:** Sets new `access_token` + `refresh_token` cookies.

```ts
// 1. Read refresh_token from cookie
// 2. Call rotateRefreshToken(db, token)
// 3. If null → 401 (revoked or expired)
// 4. Sign new JWT
// 5. Set both cookies
// 6. Return { ok: true, data: { expires_in: JWT_EXPIRY_SECONDS } }
```

### `POST /auth/logout`

Revokes current token family, clears cookies.

**Requires:** `authMiddleware`

```ts
// 1. Get family_id from JWT payload (fam)
// 2. Revoke entire family: UPDATE refresh_tokens SET revoked_at WHERE family_id = fam
// 3. Clear access_token cookie (maxAge: 0)
// 4. Clear refresh_token cookie (maxAge: 0)
// 5. Return { ok: true }
```

### `POST /auth/logout-all`

Revokes ALL token families for the user (signs out everywhere).

**Requires:** `authMiddleware`

```ts
// 1. Get user_id from JWT payload (sub)
// 2. Revoke all families: UPDATE refresh_tokens SET revoked_at WHERE user_id = sub
// 3. Clear cookies
// 4. Return { ok: true }
```

### `GET /auth/me`

Returns current user profile and active roles.

**Requires:** `authMiddleware`

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "github_username": "janedoe",
    "avatar_url": "https://...",
    "auth_provider": "github",
    "created_at": "2026-01-15T...",
    "last_login_at": "2026-02-15T..."
  }
}
```

### `GET /auth/sessions`

Lists active sessions (one per token family).

**Requires:** `authMiddleware`

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "family_id": "uuid",
      "created_at": "2026-02-10T...",
      "last_used_at": "2026-02-15T...",
      "is_current": true
    }
  ]
}
```

### `DELETE /auth/sessions/:familyId`

Revokes a specific session.

**Requires:** `authMiddleware`
**Validation:** familyId must belong to the authenticated user.

### `DELETE /auth/account`

Initiates account deletion. Sends confirmation email with a token.

### `POST /auth/account/delete-confirm`

Confirms account deletion with the emailed token. Soft-deletes user data.

### `GET /auth/account/export`

GDPR data export. Returns all user data as JSON.

## Frontend Token Refresh Pattern

The frontend API client (`apiRequest<T>()`) handles 401s automatically:

```ts
async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  let response = await fetch(url, { ...options, credentials: 'include' });

  if (response.status === 401) {
    // Try refreshing
    const refreshResponse = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshResponse.ok) {
      // Retry original request with new cookies
      response = await fetch(url, { ...options, credentials: 'include' });
    } else {
      // Refresh failed — redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  return response.json();
}
```

## Implementation Notes

- Cookies are per-subdomain — `platform.devsage.org`, `devsage.org`, and `shikdd.devsage.org` each have their own cookies
- Never set cookie domain to `.devsage.org` — this is an anti-pattern that leaks cookies across subdomains
- The refresh token cookie path is `/auth/refresh` so it's only sent on refresh requests (not every API call)
