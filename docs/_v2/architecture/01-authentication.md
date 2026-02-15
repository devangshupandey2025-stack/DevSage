# 01 — Authentication & Sessions

> Manual OAuth 2.0 with GitHub (primary) and Google (secondary), stateless JWT in HttpOnly cookies, no external auth libraries.

**Related docs:** [Roles & Permissions](./06-roles-permissions.md) | [API Design](./11-api-design.md) | [Infrastructure](./12-infrastructure.md)

---

## Overview

DevSage uses a custom authentication system built entirely on Web Crypto APIs (`crypto.subtle`). No external JWT libraries. No `@hono/oauth-providers` (broken on Cloudflare Workers).

- **Providers**: GitHub (primary, required), Google (secondary, optional)
- **Token**: Stateless JWT stored in HttpOnly cookie
- **Session**: No server-side session state — JWT is self-contained
- **Roles**: NOT stored in JWT — resolved per-request per-hackathon (see [06-roles-permissions.md](./06-roles-permissions.md))

---

## OAuth 2.0 Flow

### GitHub OAuth (Primary)

```mermaid
sequenceDiagram
    participant U as User Browser
    participant W as API Worker
    participant KV as Workers KV
    participant GH as GitHub OAuth
    participant D1 as D1 Database

    U->>W: GET /auth/github?origin=https://devsage.org
    W->>W: Generate random state
    W->>KV: Store state → origin (10-min TTL)
    W->>U: 302 Redirect → github.com/login/oauth/authorize<br/>(scope: read:user, user:email)

    U->>GH: User authorizes app
    GH->>U: 302 Redirect → /auth/callback/github?code=...&state=...

    U->>W: GET /auth/callback/github?code=...&state=...
    W->>KV: Validate & consume state
    KV-->>W: origin URL
    W->>GH: POST github.com/login/oauth/access_token<br/>(code exchange)
    GH-->>W: access_token
    W->>GH: GET api.github.com/user<br/>(fetch profile)
    GH-->>W: { id, login, name, email, avatar_url }

    W->>D1: Upsert user (github_id as key)
    D1-->>W: User record

    W->>W: signJWT({ sub, ghid, ghu })
    W->>U: Set-Cookie: session=<JWT><br/>(HttpOnly, Secure, SameSite=Lax)<br/>302 Redirect → origin/auth/callback
```

### Google OAuth (Secondary)

Same flow but:
- Endpoint: `accounts.google.com/o/oauth2/v2/auth`
- Scope: `openid profile email`
- Token exchange: `oauth2.googleapis.com/token`
- Profile: decoded from ID token or `googleapis.com/oauth2/v2/userinfo`
- On callback: if user has no `github_id` → redirect to `/link-required` (GitHub is required for bot features)

### Account Linking

Users who sign in with Google first must link a GitHub account:

```mermaid
flowchart TD
    A[Google OAuth callback] --> B{User has github_id?}
    B -->|Yes| C[Set JWT cookie → /dashboard]
    B -->|No| D[Set JWT cookie → /link-required]
    D --> E[User clicks 'Link GitHub']
    E --> F[GitHub OAuth flow]
    F --> G[Merge accounts: set github_id on existing user]
    G --> C
```

---

## JWT Token Design

### Payload Structure

```typescript
interface JWTPayload {
  sub: string;    // user.id (UUID)
  ghid: number;   // github_id
  ghu: string;    // github_username
  iat: number;    // issued at (Unix seconds)
  exp: number;    // expiry (Unix seconds)
}
```

### Implementation Details

| Property | Value |
|----------|-------|
| Algorithm | HMAC-SHA256 via `crypto.subtle` |
| Secret | `JWT_SECRET` (Worker secret) |
| Expiry | 7 days (604,800 seconds) |
| Storage | HttpOnly cookie named `session` |
| CSRF protection | `SameSite=Lax` (dev) / `SameSite=Strict` + `Secure` (prod) |
| Verification cost | ~0.5ms CPU per request |
| Server-side state | None (fully stateless) |

### What is NOT in the JWT

- **Roles** — resolved per-request per-hackathon via database query
- **Email** — may change; always fetch from DB
- **Display name** — may change; always fetch from DB
- **Permissions** — derived from roles at request time

---

## Cookie Configuration

```typescript
// Production
{
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
  path: '/',
  maxAge: 604800,         // 7 days
  domain: '.devsage.org'  // Shared across subdomains
}

// Development
{
  httpOnly: true,
  secure: false,
  sameSite: 'Lax',
  path: '/',
  maxAge: 604800
}
```

---

## Middleware Chain

### `authMiddleware` (strict)

Used on all protected routes. Rejects unauthenticated requests.

```mermaid
flowchart LR
    A[Request] --> B{Cookie present?}
    B -->|No| C[401 NO_TOKEN]
    B -->|Yes| D{JWT valid?}
    D -->|No| E[401 INVALID_TOKEN]
    D -->|Yes| F["Set c.user = #123; sub, ghid, ghu #125;"]
    F --> G["next()"]
```

### `optionalAuth` (lenient)

Used on public routes that benefit from knowing the user (e.g., leaderboard visibility).

```mermaid
flowchart LR
    A[Request] --> B{Cookie present?}
    B -->|No| C["next() — user = null"]
    B -->|Yes| D{JWT valid?}
    D -->|No| C
    D -->|Yes| E["Set c.user = #123; sub, ghid, ghu #125;"]
    E --> F["next()"]
```

---

## Frontend Auth Flow

```mermaid
sequenceDiagram
    participant U as User
    participant SPA as React SPA
    participant AP as AuthProvider
    participant API as API Worker

    U->>SPA: Navigate to app
    SPA->>AP: Mount AuthProvider
    AP->>API: GET /auth/me (credentials: include)

    alt Cookie present & valid
        API-->>AP: { ok: true, data: { user } }
        AP->>AP: Set state: authenticated
        AP->>SPA: Render dashboard
    else No cookie or invalid
        API-->>AP: 401
        AP->>AP: Set state: unauthenticated
        AP->>SPA: Render login page
    end

    Note over SPA: On 401 from any API call → redirect to /login
```

### AuthContext API

```typescript
const { user, isAuthenticated, isLoading, logout } = useAuth();
```

| Field | Type | Description |
|-------|------|-------------|
| `user` | `User \| null` | Current user object with `id`, `github_username`, `display_name`, etc. |
| `isAuthenticated` | `boolean` | Whether user is logged in |
| `isLoading` | `boolean` | True during initial `/auth/me` check |
| `logout()` | `() => Promise<void>` | Calls `POST /auth/logout`, clears state, redirects to `/` |

---

## Security Considerations

| Threat | Mitigation |
|--------|-----------|
| XSS token theft | HttpOnly cookie — JS cannot access |
| CSRF | `SameSite=Strict` (prod) + `Origin` header check on mutations |
| Token replay | 7-day expiry; no refresh tokens (user re-authenticates) |
| Timing attacks on JWT verify | `crypto.subtle` uses constant-time comparison internally |
| OAuth state forgery | Random state stored in KV with 10-min TTL, consumed on use |
| Account takeover | GitHub ID is the primary key; Google ID is optional secondary |

---

## File References

| File | Purpose |
|------|---------|
| `apps/api/src/routes/auth.ts` | OAuth routes (initiate, callback, /me, logout) |
| `apps/api/src/lib/jwt.ts` | `signJWT()`, `verifyJWT()` — HMAC SHA-256 |
| `apps/api/src/lib/cookies.ts` | `setSessionCookie()`, `getSessionCookie()`, `clearSessionCookie()` |
| `apps/api/src/lib/oauth.ts` | Manual OAuth HTTP flows for GitHub + Google |
| `apps/api/src/middleware/auth.ts` | `authMiddleware`, `optionalAuth` |
| `apps/web/src/contexts/auth-context.tsx` | `AuthProvider`, `useAuth()` hook |
| `apps/web/src/lib/api.ts` | `apiRequest()` — auto-includes credentials |
| `apps/web/src/pages/login.tsx` | OAuth button UI |
| `apps/web/src/pages/auth-callback.tsx` | Post-OAuth redirect handler |
| `apps/web/src/pages/link-required.tsx` | GitHub account linking flow |
