# 01 — Authentication & Sessions

> Dual-token OAuth authentication with GitHub and Google providers, HttpOnly cookie transport, and family-based refresh token rotation.

## Architecture

```
Client → OAuth Provider → /auth/callback → JWT + Refresh Token → HttpOnly Cookies
                                                                      ↓
                                              Subsequent requests read `access_token` cookie
                                                                      ↓
                                              authMiddleware extracts + verifies JWT
                                                                      ↓
                                              On 401 → client calls POST /auth/refresh
                                                       → rotates refresh token
                                                       → issues new access_token
```

## Token Architecture

| Token | Format | Lifetime | Storage | Transport |
|-------|--------|----------|---------|-----------|
| Access | JWT (HS256) | 15 min | None (stateless) | `access_token` HttpOnly cookie |
| Refresh | Opaque hex | 30 days | SHA-256 hash in `refresh_tokens` table | `refresh_token` HttpOnly cookie (path=/auth/refresh) |

**JWT Payload:**
```ts
interface JWTPayload {
  sub: string;   // user UUID
  ghid?: number; // GitHub user ID (absent for Google-only users)
  ghu?: string;  // GitHub username (absent for Google-only users)
  fam: string;   // token family ID (links refresh chain)
  iat: number;   // issued at
  exp: number;   // expires at
}
```

## Auth Providers

| Provider | Who | Scopes | Purpose |
|----------|-----|--------|---------|
| GitHub | Participants + Organizers | `read:user, user:email` | Primary identity, repo access |
| Google | Organizers + Admins | `openid, email, profile` | Secondary identity for org accounts |

GitHub scope elevation (`/auth/github/elevate`) adds `repo` scope for bot features after initial signup.

## Cookie Strategy

- **SameSite**: `None` in production (required for cross-origin credentialed requests), `Lax` in dev
- **Secure**: `true` in production (required with `SameSite=None`), `false` in dev
- **Domain**: Cookies scoped to `api.devsage.org` (no explicit `Domain` attribute). All frontends make credentialed requests to this single API origin.
- **Path**: `/` for access token, `/auth/refresh` for refresh token
- **Cross-subdomain**: Works because all frontends (`platform.devsage.org`, `{slug}.devsage.org`, etc.) call the same API origin. See [04-session-management.md](./04-session-management.md#cross-subdomain-auth-strategy) for details.

## Files in This Section

| File | What to Build |
|------|---------------|
| [01-github-oauth-flow.md](./01-github-oauth-flow.md) | GitHub OAuth endpoints, state management, callback handler |
| [02-google-oauth-flow.md](./02-google-oauth-flow.md) | Google OAuth endpoints, state management, callback handler |
| [03-token-lifecycle.md](./03-token-lifecycle.md) | JWT sign/verify, refresh rotation, replay detection |
| [04-session-management.md](./04-session-management.md) | Cookie config, logout, session listing, token refresh |
| [05-account-linking.md](./05-account-linking.md) | Multi-provider linking, conflict resolution |
| [06-auth-middleware.md](./06-auth-middleware.md) | authMiddleware + optionalAuth implementation |

## Dependencies

- `apps/api/src/lib/jwt.ts` — JWT sign/verify via `crypto.subtle`
- `apps/api/src/lib/refresh-token.ts` — Refresh token generation/rotation
- `apps/api/src/lib/cookies.ts` — Cookie helpers
- `apps/api/src/lib/oauth.ts` — OAuth URL builders
- `packages/db/src/schema/users.ts` — Users table
- `packages/db/src/schema/refresh-tokens.ts` — Refresh tokens table
- **KV** — OAuth state storage (10-min TTL)
