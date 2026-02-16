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
  sameSite: determineSameSite(env),
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
  sameSite: determineSameSite(env),
  path: '/auth/refresh',              // only sent to refresh endpoint
  maxAge: REFRESH_TOKEN_EXPIRY_SECONDS, // 2592000 (30 days)
}
```

### SameSite Logic

```ts
function determineSameSite(env: Env): 'Lax' | 'None' {
  // Note: parameter is `env: Env`, not `origin: string` — decision is based on env.ENVIRONMENT
  // Production: SameSite=None required because frontends (platform.devsage.org,
  // {slug}.devsage.org) make cross-origin requests to api.devsage.org
  if (env.ENVIRONMENT === 'production' || env.ENVIRONMENT === 'staging') return 'None';
  // Dev: Lax is fine since all apps are on localhost (different ports = same site)
  return 'Lax';
}
```

**Note:** `SameSite=None` requires `Secure=true`. In production, all traffic is HTTPS so this is always satisfied.

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

## Cross-Subdomain Auth Strategy

The API lives at `api.devsage.org`. Each frontend app is on a different subdomain (`platform.devsage.org`, `shikdd.devsage.org`, `{slug}.devsage.org`). Since cookies are scoped to the origin that sets them, and the API sets the cookies, here is how auth works:

**Cookie domain:** Cookies are set by the API Worker (`api.devsage.org`) and **scoped to `api.devsage.org`** (no explicit `Domain` attribute). This means cookies are only sent to the API -- never to frontend origins.

**How it works:**
1. Frontend redirects user to `/auth/github` on `api.devsage.org`
2. After OAuth, API sets HttpOnly cookies on `api.devsage.org`
3. API redirects user back to the originating frontend URL (stored in KV OAuth state)
4. Frontend calls `api.devsage.org/auth/me` with `credentials: 'include'` -- cookies are sent because the request goes to `api.devsage.org`
5. All subsequent API calls from any frontend go to `api.devsage.org` -- cookies always included

**Key insight:** Since ALL frontends talk to the SAME API origin (`api.devsage.org`), cookies set by the API are available to requests from any frontend. This is not cookie sharing across subdomains -- it's all frontends making credentialed requests to a single API origin.

**CORS configuration:** The API must allowlist each frontend origin explicitly (not `*`):
```ts
const ALLOWED_ORIGINS = [
  env.FRONTEND_URL,    // https://devsage.org
  env.PLATFORM_URL,    // https://platform.devsage.org
  env.ADMIN_URL,       // https://shikdd.devsage.org
  // Dynamically add {slug}.devsage.org origins for active hackathons
];
```

**Participant sites (`{slug}.devsage.org`):** These live in separate repos but call the same API. Their origin must be in the CORS allowlist. Options:
1. **Wildcard subdomain matching:** Allow `*.devsage.org` in CORS (simpler, slightly less restrictive)
2. **Dynamic lookup:** Check if the origin matches an active hackathon slug (more secure, requires DB lookup -- cache in KV)

Recommended: Use wildcard `*.devsage.org` for Phase 1, tighten to dynamic lookup in Phase 2.

## Implementation Notes

- Cookies are set on `api.devsage.org` -- the API origin, not the frontend origin
- `SameSite=None` + `Secure=true` required for cross-origin credentialed requests in production
- `credentials: 'include'` on every `fetch()` call from frontends is mandatory
- The refresh token cookie path is `/auth/refresh` so it's only sent on refresh requests (not every API call)
- In dev, all apps run on `localhost` with different ports -- CORS and cookies work naturally
