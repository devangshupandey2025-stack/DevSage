# 02 — Authentication & Authorization

## Auth Model

Dual-token, cookie-based authentication. No Bearer tokens in headers (except fallback).

| Token | Type | Storage | Lifetime | Purpose |
|-------|------|---------|----------|---------|
| Access Token | JWT (HS256) | HttpOnly cookie `access_token` | 15 minutes | Request authentication |
| Refresh Token | Opaque (SHA-256 hash) | HttpOnly cookie `refresh_token` | 30 days | Token renewal |

### JWT Payload
```json
{
  "sub": "user-uuid",
  "ghid": "github-numeric-id",
  "ghu": "github-username",
  "fam": "refresh-token-family-id",
  "iat": 1708837641,
  "exp": 1708838541
}
```

### Cookie Configuration
- `HttpOnly: true` — JavaScript cannot read tokens
- `Secure: true` — HTTPS only (production)
- `SameSite: Lax` — CSRF protection
- `Path: /` — Available to all routes
- **No `Domain` attribute** — cookies are per-subdomain to prevent cross-domain leakage

### JWT Implementation
- Custom HMAC-SHA256 via `crypto.subtle` (no external JWT library)
- `signJWT()` / `verifyJWT()` in `apps/api/src/lib/jwt.ts`
- Key: `JWT_SECRET` environment variable

## Auth Endpoints (19 total)

### Registration & Login
| Method | Path | Rate Limited | Body | Sets Cookies |
|--------|------|-------------|------|-------------|
| POST | `/auth/register` | ✅ | `{email, name, password}` | ✅ access + refresh |
| POST | `/auth/login` | ✅ | `{email, password}` | ✅ access + refresh |

### OAuth Flows
| Method | Path | Rate Limited | Flow |
|--------|------|-------------|------|
| GET | `/auth/google` | ✅ | Store state in KV → redirect to Google |
| GET | `/auth/callback/google` | ✅ | Exchange code → upsert user → set cookies → redirect |
| GET | `/auth/github` | ✅ | Store state in KV → redirect to GitHub |
| GET | `/auth/callback/github` | ✅ | Exchange code → upsert user → set cookies → redirect |

OAuth state stored in KV with 10-minute TTL. State includes the `origin` (which app initiated: web, platform, admin, judge) so the callback redirects to the correct frontend.

### Token Management
| Method | Path | Auth Required | Action |
|--------|------|--------------|--------|
| POST | `/auth/refresh` | ❌ (uses cookie) | Rotate refresh token, issue new access token |
| POST | `/auth/logout` | ✅ | Revoke entire token family, clear cookies |

Refresh token rotation uses **family-based replay detection**:
- Each refresh token belongs to a "family" (initial login)
- On refresh: old token revoked, new token issued in same family
- If a revoked token is reused → entire family revoked (breach detection)
- 2-second grace period for concurrent requests

### Session Management
| Method | Path | Auth Required | Action |
|--------|------|--------------|--------|
| GET | `/auth/sessions` | ✅ | List active sessions (grouped by family) |
| DELETE | `/auth/sessions/:familyId` | ✅ | Revoke one session |
| DELETE | `/auth/sessions` | ✅ | Revoke all sessions |

### Profile & Password
| Method | Path | Auth Required | Action |
|--------|------|--------------|--------|
| GET | `/auth/me` | ✅ | User profile + roles + `password_must_change` flag |
| POST | `/auth/change-password` | ✅ | Change password (forced for temp judge credentials) |
| POST | `/auth/forgot-password` | ❌ | Send password reset email (always returns success) |
| POST | `/auth/reset-password` | ❌ | Reset with token from email |

### Email Verification
| Method | Path | Auth Required | Action |
|--------|------|--------------|--------|
| POST | `/auth/send-verification` | ✅ | Send 6-digit OTP to user's email |
| POST | `/auth/verify-email` | ✅ | Verify OTP (5 attempt limit) |

### Account Deletion
| Method | Path | Auth Required | Action |
|--------|------|--------------|--------|
| POST | `/auth/delete-account` | ✅ | Request deletion (returns confirmation token) |
| POST | `/auth/delete-account/confirm` | ✅ | Confirm with token → hard delete |

## Role System

### Platform Roles (global)
| Role | Scope | Check |
|------|-------|-------|
| Platform Admin | Entire platform | `platform_admins` table |

### Workspace Roles (per workspace)
| Role | Scope | Check |
|------|-------|-------|
| Owner | Workspace-wide | `workspace_members.role = 'owner'` (max 2) |
| Admin | Workspace-wide | `workspace_members.role = 'admin'` |
| Member | Workspace-wide | `workspace_members.role = 'member'` |

### Hackathon Roles (per hackathon, resolved per-request)
| Role | Hierarchy Level | Check |
|------|----------------|-------|
| `organizer` | 1 (highest) | `organizer_roles.role = 'organizer'` |
| `co_organizer` | 2 | `organizer_roles.role = 'co_organizer'` |
| `judge` | 3 | `judges` table (accepted invite) |
| `team_lead` | 4 | `team_members.role = 'team_lead'` |
| `team_member` | 5 | `team_members.role = 'team_member'` |
| `anonymous` | 6 (lowest) | Fallback when no role found |

### Role Resolution (`resolveRole()`)

Roles are **NOT stored in the JWT**. They are resolved per-request per-hackathon:

```
1. Check organizer_roles → organizer/co_organizer
2. Check judges (accepted) → judge
3. Check team_members → team_lead/team_member
4. Check workspace_members → maps to equivalent hackathon role
5. Fallback → anonymous
```

This is cached in KV for 60 seconds per user+hackathon combo.

### `requireRole(minRole)` Middleware

Checks that the resolved role's hierarchy level is ≤ the minimum required:
- `requireRole('organizer')` — only organizers
- `requireRole('co_organizer')` — organizers + co-organizers
- `requireRole('judge')` — organizers + co-organizers + judges
- `requireRole('member')` — anyone with any role in the hackathon

### Login Access Control (per app origin)

| Origin | Who Can Log In | Enforced At |
|--------|---------------|-------------|
| `devsage.org` | Anyone | Always allowed |
| `platform.devsage.org` | Workspace member OR platform admin | `/auth/login`, `/auth/callback/*` |
| `shikdd.devsage.org` | Platform admin only | `/auth/login`, `/auth/callback/*` |
| `judge.devsage.org` | Accepted judge only | `/auth/login`, `/auth/callback/*` |

This is enforced by checking the `Origin` or `Referer` header during login/OAuth and querying the appropriate membership table.

## Password Handling

- Hashing: Argon2id via `apps/api/src/lib/password.ts`
- Minimum: 8 characters
- Judge temp passwords: `password_must_change = true` → forced reset on first login
- Password changes revoke all existing sessions (all token families)

## Rate Limiting

All auth endpoints use `rateLimitMiddleware('auth')`:
- Per-IP rate limiting via KV
- Returns 429 with `Retry-After` header
- Does NOT apply to authenticated endpoints (those use per-user limits)
