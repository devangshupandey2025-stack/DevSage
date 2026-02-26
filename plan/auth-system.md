# Authentication & Authorization System

> **Status:** Implemented (core), with known gaps  
> **Last updated:** 2026-02-15  
> **Owner:** API team (`apps/api`)  
> **Runtime:** Cloudflare Workers (single Worker)

---

## 1. Overview

The DevSage auth system provides authentication and authorization for all four frontend applications and the API. It runs entirely within a single Cloudflare Worker (`apps/api`) — there is no separate auth service.

**Who uses it:**

| App | Domain | Auth requirement |
|-----|--------|-----------------|
| Web (participant) | `devsage.org` | Public site. No auth implemented yet (planned) |
| Platform (organizer) | `platform.devsage.org` | Required — organizer/workspace member access |
| Admin | `shikdd.devsage.org` | Required — platform admin only |
| Judge | `judge.devsage.org` | Required — accepted judge invitation |

**What it provides:**

- Email/password registration and login
- OAuth login via GitHub and Google
- 6-digit OTP email verification
- Password reset (email link) and forced password change (judges)
- Session management with refresh token rotation
- Per-hackathon role-based authorization (6-tier hierarchy)
- Platform admin authorization (separate table)
- Workspace-level roles (owner, admin, member)
- Account deletion with confirmation token

**Key design decisions:**

- All auth endpoints live at `/auth/*` on the API Worker
- Cookie-based authentication (HttpOnly), not bearer tokens
- Custom JWT implementation using `crypto.subtle` (no external libraries)
- Roles are resolved per-request from the database, never stored in the JWT
- OAuth state stored in Cloudflare KV with 10-minute TTL

---

## 2. Architecture

### 2.1 Dual-Token Model

The system uses two tokens working together:

```
┌─────────────────────────┐     ┌──────────────────────────┐
│     Access Token (JWT)  │     │  Refresh Token (opaque)  │
├─────────────────────────┤     ├──────────────────────────┤
│ Type: JWT (HS256)       │     │ Type: 64-char hex string │
│ Lifetime: 15 minutes    │     │ Lifetime: 30 days        │
│ Storage: HttpOnly cookie│     │ Storage: HttpOnly cookie │
│ Cookie name: access_token│    │ Cookie name: refresh_token│
│ Cookie path: /          │     │ Cookie path: /auth/refresh│
│ Sent on: every request  │     │ Sent on: refresh only    │
└─────────────────────────┘     └──────────────────────────┘
```

**Access token** — Short-lived JWT used for API authentication on every request. Contains user identity (`sub`) and token family (`fam`). Validated by the `optionalAuth` middleware.

**Refresh token** — Long-lived opaque token stored as a SHA-256 hash in D1. Used only at `POST /auth/refresh` to obtain a new access token + new refresh token (rotation). The cookie path is restricted to `/auth/refresh` so it is never sent on regular API calls.

### 2.2 JWT Implementation

**File:** `apps/api/src/lib/jwt.ts`

- Algorithm: HMAC SHA-256 via `crypto.subtle`
- No external JWT library — fully custom implementation
- Signing key: `JWT_SECRET` environment variable
- Expiry: 15 minutes (900 seconds)

**JWT Payload** (`apps/api/src/types/auth.ts`):

```typescript
interface JWTPayload {
  sub: string;              // User ID (UUID)
  ghid?: number | null;     // GitHub user ID
  ghu?: string | null;      // GitHub username
  email?: string;           // User email (optional, for legacy Bearer path)
  name?: string;            // Display name (optional, for legacy Bearer path)
  image?: string | null;    // Avatar URL (optional, for legacy Bearer path)
  platformAdmin?: boolean;  // (optional, for legacy Bearer path)
  workspaceRoles?: Record<string, string>;     // (optional, for legacy Bearer path)
  hackathonRoles?: Record<string, string[]>;   // (optional, for legacy Bearer path)
  fam: string;              // Token family ID (for refresh token rotation)
  iat: number;              // Issued at (Unix seconds)
  exp: number;              // Expires at (Unix seconds)
}
```

> **Important:** The JWT intentionally does NOT contain roles. Roles are resolved per-request from the database by the `optionalAuth` middleware (cookie path) or by `resolveRole()` for hackathon-specific authorization.

### 2.3 Cookie Configuration

**File:** `apps/api/src/lib/cookies.ts`

| Property | Access Token | Refresh Token |
|----------|-------------|---------------|
| `httpOnly` | `true` | `true` |
| `secure` | `true` in production | `true` in production |
| `sameSite` | `None` (HTTPS) / `Lax` (HTTP) | `None` (HTTPS) / `Lax` (HTTP) |
| `path` | `/` | `/auth/refresh` |
| `maxAge` | 900 (15 min) | 2,592,000 (30 days) |

- `sameSite: None` is required for cross-origin cookie delivery in production (API on `api.devsage.org`, frontends on different subdomains)
- `secure: true` is auto-detected from the request URL (`https://` check)
- No explicit `domain` attribute — cookies are per-origin to prevent cross-subdomain leakage

### 2.4 Middleware Pipeline

**Request flow through auth middleware:**

```
Request
  │
  ├─ CORS (allowed-origin.ts)
  ├─ Request ID (request-id.ts)
  ├─ Rate Limiter (rate-limit.ts) — tier-based via KV
  ├─ Error Handler
  ├─ optionalAuth (auth.ts) — extracts JWT, resolves user + all roles from DB
  │    ├─ Cookie path: full DB lookup (user, platform admin, workspace, hackathon roles)
  │    └─ Bearer path: trusts JWT payload directly (legacy/test compatibility)
  │
  ├─ Per-route guards:
  │    ├─ authMiddleware — requires user to be non-null
  │    ├─ requireRole(minRole) — hierarchy-based per-hackathon check
  │    ├─ requireExactRole(...roles) — exact match per-hackathon check
  │    └─ requirePlatformAdmin — checks platform_admins table
  │
  └─ Route Handler
```

### 2.5 CORS Configuration

**File:** `apps/api/src/lib/allowed-origin.ts`

The CORS middleware allows requests from:

1. **Static origins:** `FRONTEND_URL`, `PLATFORM_URL`, `ADMIN_URL`, `JUDGE_URL`
2. **Wildcard patterns:** `HACKATHON_ORIGIN_PATTERN` (e.g., `https://*.hackathon.devsage.org`), `PAGES_ORIGIN_PATTERN` (e.g., `https://*.pages.dev`), `WORKERS_ORIGIN_PATTERN`

Patterns are converted to regex at startup. The `isAllowedOrigin()` function checks incoming `Origin` headers against all static + pattern matchers.

---

## 3. User Flows

### 3.1 Registration (Email/Password)

**Endpoint:** `POST /auth/register`

**Request body:**
```json
{
  "email": "user@example.com",
  "name": "Jane Doe",
  "password": "securepassword"
}
```

**Flow:**

1. Validate email format (regex), name (non-empty), password (8–128 characters)
2. Check for existing user with same email → `409 CONFLICT` if found
3. Hash password using PBKDF2-SHA256 (100,000 iterations, 16-byte random salt)
4. Insert new user row in `users` table with `crypto.randomUUID()` as ID
5. Issue session cookies (new token family → access JWT + refresh token)
6. Log audit event `auth.signup`
7. Return `201` with `{ id, email, name }`

**Cookies set:** `access_token`, `refresh_token`

**Error cases:**

| Code | Error | Reason |
|------|-------|--------|
| 400 | `VALIDATION_ERROR` | Invalid email, missing name, or password < 8 or > 128 chars |
| 409 | `CONFLICT` | Email already registered |
| 429 | `RATE_LIMITED` | Exceeded 10 requests/minute on auth tier |

**Note:** Registration does NOT send a verification email automatically. The user must call `POST /auth/send-verification` separately after registration.

### 3.2 Login (Email/Password)

**Endpoint:** `POST /auth/login`

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Flow:**

1. Look up user by email
2. Verify password hash using constant-time comparison (HMAC-based)
3. Determine calling app from `Origin` header → `resolveAppOrigin()`
4. Check login access based on app origin:
   - **Participant (web):** Always allowed
   - **Admin:** Must be in `platform_admins` table
   - **Judge:** Must have an accepted judge invitation
   - **Platform:** Must be workspace member, or platform admin
5. Issue session cookies (new token family)
6. Update `last_login_at` on user record
7. Log audit event `auth.login`
8. Return user data including `password_must_change` flag

**Cookies set:** `access_token`, `refresh_token`

**Error cases:**

| Code | Error | Reason |
|------|-------|--------|
| 400 | `VALIDATION_ERROR` | Missing email or password |
| 401 | `INVALID_CREDENTIALS` | Wrong email/password (same message for both to prevent enumeration) |
| 403 | `ACCESS_DENIED` | User exists but doesn't have access to the requesting app |
| 429 | `RATE_LIMITED` | Exceeded 10 requests/minute |

### 3.3 OAuth Login (Google + GitHub)

Both OAuth providers follow the same pattern: initiate → redirect to provider → callback → issue cookies.

#### 3.3.1 GitHub OAuth

**Initiate:** `GET /auth/github?origin=https://platform.devsage.org`

1. Generate random state (UUID)
2. Store state in KV with 10-minute TTL: `oauth:state:{uuid}` → `{ provider, redirectUri, frontendOrigin, createdAt }`
3. Build GitHub authorization URL with scopes `read:user user:email`
4. Redirect user to GitHub

**Callback:** `GET /auth/callback/github?code=...&state=...`

1. Validate `code` and `state` params exist
2. Consume state from KV (read + delete, one-time use)
3. Exchange code for access token at `https://github.com/login/oauth/access_token`
4. Fetch user profile from `https://api.github.com/user`
5. Fetch user emails from `https://api.github.com/user/emails` (select primary verified email)
6. Upsert user: if `github_id` exists → update; otherwise create new user
7. Check login access for target app
8. Issue session cookies
9. Redirect to `{frontendOrigin}/dashboard` (or `/` for admin)

**Error handling:** On failure, redirect to `{frontendOrigin}/login?error=oauth_failed`

#### 3.3.2 Google OAuth

**Initiate:** `GET /auth/google?origin=https://platform.devsage.org`

Same flow as GitHub, with scopes `openid email profile` and Google endpoints.

**Callback:** `GET /auth/callback/google?code=...&state=...`

1–6. Same as GitHub
7. Google OAuth links to an **existing user by email** — it does NOT create new accounts. If no user with that email exists, redirects to `/link-required`
8–9. Same as GitHub

**Key difference:** GitHub creates new users on first OAuth login. Google only links to existing accounts (the user must register via email/password or GitHub first).

#### OAuth State Management

- States stored in KV at `oauth:state:{uuid}` with 600-second (10-minute) TTL
- States are consumed (deleted) on callback — single-use
- Each state records: provider, redirect URI, frontend origin, creation timestamp
- All external fetches use a 10-second `AbortController` timeout

### 3.4 Token Refresh

**Endpoint:** `POST /auth/refresh`

**Flow:**

1. Read `refresh_token` cookie (path-restricted, only sent to `/auth/refresh`)
2. Try to extract `userId` from the access token JWT (may be expired but still readable)
3. If no userId from JWT, look up the refresh token hash in `refresh_tokens` table
4. Call `rotateRefreshToken()`:
   a. Hash the incoming token
   b. Look up the token record in DB
   c. Verify it belongs to the claimed user and hasn't expired
   d. **Replay detection:** If the token has already been revoked:
      - If within 2-second grace period → allow (handles network retries)
      - If beyond grace period → **revoke the entire token family** (theft detected)
   e. Revoke the old token (set `revoked_at`)
   f. Create a new token in the same family
5. Sign a new access JWT
6. Set both new cookies
7. Return `{ refreshed: true }`

**Cookies set:** New `access_token`, new `refresh_token`

**Error cases:**

| Code | Error | Reason |
|------|-------|--------|
| 401 | `AUTH_REQUIRED` | No refresh token cookie present |
| 401 | `AUTH_REQUIRED` | Invalid refresh token (not found in DB) |
| 401 | `TOKEN_EXPIRED` | Token expired, revoked, or replay attack detected |

**Replay detection explained:** Each refresh token can only be used once. When a token is used, it's revoked and replaced. If a revoked token is presented again after the 2-second grace period, the system assumes token theft and revokes ALL tokens in that family, forcing the legitimate user (and attacker) to re-authenticate.

### 3.5 Logout

**Endpoint:** `POST /auth/logout`

**Requires:** Authenticated user (`authMiddleware`)

**Flow:**

1. Extract token family ID (`fam`) from the access token JWT
2. Revoke all tokens in that family (`revokeTokenFamily`)
3. Clear both auth cookies
4. Log audit event `auth.logout`
5. Return `{ logged_out: true }`

**Cookies cleared:** `access_token`, `refresh_token`

### 3.6 Password Reset

**Step 1 — Request Reset:** `POST /auth/forgot-password`

```json
{ "email": "user@example.com" }
```

1. Look up user by email (must have `password_hash` — OAuth-only accounts cannot reset)
2. Generate a UUID reset token
3. Store in KV at `pwd_reset:{token}` with 30-minute TTL, containing `{ userId, email }`
4. Send password reset email with link: `{frontendOrigin}/reset-password?token={token}`
5. **Always return success** to prevent email enumeration: `"If that email exists, a reset link has been sent"`

**Step 2 — Execute Reset:** `POST /auth/reset-password`

```json
{ "token": "uuid-token", "password": "newsecurepassword" }
```

1. Validate password (8–128 characters)
2. Look up token in KV (`pwd_reset:{token}`)
3. Hash new password, update user record
4. Delete KV token (one-time use)
5. **Revoke all existing sessions** for that user (security: force re-login everywhere)
6. Log audit event `auth.password_reset`

**Error cases:**

| Code | Error | Reason |
|------|-------|--------|
| 400 | `VALIDATION_ERROR` | Missing token or password too short/long |
| 400 | `TOKEN_EXPIRED` | Token not found in KV (expired or already used) |

### 3.7 Password Change

**Endpoint:** `POST /auth/change-password`

**Requires:** Authenticated user

```json
{
  "current_password": "oldpassword",
  "new_password": "newsecurepassword"
}
```

**Flow:**

1. Validate both passwords present, new password 8–128 chars
2. Verify current password against stored hash
3. Hash new password, update user record
4. Clear `password_must_change` flag (used for judge temporary credentials)
5. **Revoke all existing sessions** (force re-login)
6. Log audit event `auth.password_changed`

**Error cases:**

| Code | Error | Reason |
|------|-------|--------|
| 400 | `VALIDATION_ERROR` | Missing fields or new password too short/long |
| 400 | `NO_PASSWORD` | Account has no password (OAuth-only) |
| 401 | `INVALID_CREDENTIALS` | Current password is wrong |

**Special case — Judge forced password change:** When organizers create judge accounts with temporary passwords, the `password_must_change` flag is set to `1`. The judge portal (`apps/judge`) checks this flag via `/auth/me` and redirects to `/change-password` if set.

### 3.8 Account Deletion

**Step 1 — Request:** `POST /auth/delete-account`

**Requires:** Authenticated user

1. Generate a confirmation token (UUID)
2. Insert into `deletion_requests` table with status `pending`
3. Return the confirmation token to the client

**Step 2 — Confirm:** `POST /auth/delete-account/confirm`

```json
{ "confirmation_token": "uuid-token" }
```

1. Look up pending deletion request for this user + token
2. Mark request as `confirmed`
3. Revoke all refresh tokens for the user
4. Clear auth cookies
5. Nullify non-cascading foreign key references:
   - `workspaces.created_by` → `'deleted-user'`
   - `hackathons.created_by` → `'deleted-user'`
6. Delete dependent records: `scores`, `judge_assignments` for this user's judge entries
7. Delete the `users` row (cascading FKs handle: `refresh_tokens`, `otp_sessions`, `email_verification_tokens`, `password_reset_tokens`)
8. Log audit event `auth.account_deleted`

### 3.9 OTP Email Verification

**Send OTP:** `POST /auth/send-verification`

**Requires:** Authenticated user

1. Check if email already verified (via KV key `email_verified:{userId}`)
2. Generate 6-digit OTP using CSPRNG (`crypto.getRandomValues`)
3. Store in KV at `email_otp:{userId}` with 10-minute TTL: `{ otp, email, attempts: 0 }`
4. Send email with the OTP code

**Verify OTP:** `POST /auth/verify-email`

**Requires:** Authenticated user

```json
{ "otp": "123456" }
```

1. Look up stored OTP from KV
2. Check attempt count (max 5 attempts per OTP)
3. Compare submitted OTP with stored value
4. On success: store `email_verified:{userId}` in KV, delete OTP key
5. Log audit event `auth.email_verified`

**Error cases:**

| Code | Error | Reason |
|------|-------|--------|
| 400 | `VALIDATION_ERROR` | Missing or non-6-digit OTP |
| 400 | `TOKEN_EXPIRED` | OTP expired (>10 minutes) |
| 400 | `INVALID_OTP` | Wrong code (increments attempt counter) |
| 429 | `TOO_MANY_ATTEMPTS` | 5+ failed attempts — OTP invalidated |

---

## 4. Authorization Model

### 4.1 Role Hierarchy (Per-Hackathon)

**File:** `apps/api/src/lib/constants.ts`, `apps/api/src/middleware/role.ts`

Six roles, ordered by decreasing privilege:

| Priority | Role | Description |
|----------|------|-------------|
| 1 | `organizer` | Full hackathon management |
| 2 | `co_organizer` | Same as organizer with slightly lower priority |
| 3 | `judge` | Score submissions, view submissions |
| 4 | `leader` (team_lead) | Team management, submit on behalf of team |
| 5 | `member` (team_member) | View team, submit |
| 6 | `anonymous` | Public read access only |

### 4.2 Role Resolution

**Function:** `resolveRole()` in `apps/api/src/middleware/role.ts`

Roles are **resolved per-request** from the database. They are NEVER stored in the JWT. This ensures role changes take effect immediately (with up to 60-second KV cache delay).

**Resolution uses a single UNION ALL query (not 4 sequential queries):**

```sql
SELECT role, priority FROM (
  -- Priority 1: organizer from organizer_roles
  SELECT role, 1 as priority FROM organizer_roles
    WHERE hackathon_id = ? AND user_id = ? AND role = 'organizer'
  UNION ALL
  -- Priority 2: co_organizer from organizer_roles
  SELECT role, 2 as priority FROM organizer_roles
    WHERE hackathon_id = ? AND user_id = ? AND role = 'co_organizer'
  UNION ALL
  -- Priority 3: judge (must have accepted invite)
  SELECT 'judge' as role, 3 as priority FROM judges
    WHERE hackathon_id = ? AND user_id = ? AND invite_status = 'accepted'
  UNION ALL
  -- Priority 4-5: team roles
  SELECT tm.role, CASE WHEN tm.role = 'leader' THEN 4 ELSE 5 END as priority
    FROM team_members tm JOIN teams t ON tm.team_id = t.id
    WHERE t.hackathon_id = ? AND tm.user_id = ?
  UNION ALL
  -- Priority 6-7: workspace member → implicit organizer/co_organizer
  SELECT CASE WHEN wm.role IN ('owner','admin') THEN 'organizer'
              ELSE 'co_organizer' END,
         CASE WHEN wm.role IN ('owner','admin') THEN 6 ELSE 7 END
    FROM workspace_members wm WHERE wm.workspace_id = ? AND wm.user_id = ?
) ORDER BY priority ASC LIMIT 1
```

**Caching:** Resolved roles are cached in KV for 60 seconds (`rl:{userId}:{hackathonId}`), fire-and-forget.

### 4.3 Role Middleware

Two middleware functions for route-level authorization:

**`requireRole(minRole)`** — Hierarchy-based. User's role level must be ≤ the required role's level. Example: `requireRole('judge')` allows organizers, co-organizers, and judges.

**`requireExactRole(...roles)`** — Exact match. Only the specified roles pass. Example: `requireExactRole('judge')` allows ONLY judges (not organizers).

### 4.4 Workspace Roles

Workspace roles are a separate layer for multi-hackathon workspaces:

| Role | Implicit Hackathon Role |
|------|------------------------|
| `owner` | `organizer` (priority 6) |
| `admin` | `organizer` (priority 6) |
| `member` | `co_organizer` (priority 7) |

Workspace membership grants implicit hackathon access at lower priority than direct role assignments.

### 4.5 Platform Admin

**File:** `apps/api/src/middleware/platform-admin.ts`

Platform admins are a completely separate authorization layer for the admin portal (`shikdd.devsage.org`):

- Stored in `platform_admins` table (user_id + added_by)
- Checked by `requirePlatformAdmin` middleware — simple DB lookup
- Also loaded by `optionalAuth` middleware into `user.platformAdmin` boolean
- Platform admins bypass no hackathon-level checks — they're for platform management only

### 4.6 Login Access Control

When a user logs in, the API checks whether they have permission to access the requesting application based on the `Origin` header:

| App Origin | Access Requirement |
|------------|-------------------|
| `participant` (web) | Always allowed |
| `admin` | Must be platform admin |
| `judge` | Must have accepted judge invitation |
| `platform` | Must be workspace member OR platform admin |

This prevents unauthorized users from logging into apps they can't use.

### 4.7 Auth Middleware Flow (`optionalAuth`)

The `optionalAuth` middleware runs on every request and:

1. Extracts token from `access_token` cookie (preferred) or `Authorization: Bearer` header (legacy)
2. Verifies JWT signature and expiry
3. **Cookie path (production):** Performs 6 parallel DB queries:
   - User lookup (`users` table)
   - Platform admin check (`platform_admins`)
   - Workspace memberships (`workspace_members`)
   - Organizer roles (`organizer_roles` joined with `hackathons`)
   - Judge roles (`judges` joined with `hackathons`, accepted only)
   - Team roles (`team_members` joined with `teams` and `hackathons`)
4. Aggregates all hackathon roles and workspace roles into the `user` context variable
5. **Bearer path (tests/legacy):** Trusts JWT payload fields directly (no DB queries)

---

## 5. Security Properties

### 5.1 Password Hashing

**File:** `apps/api/src/lib/password.ts`

- Algorithm: **PBKDF2-SHA256** (not Argon2id as originally planned — Workers don't support it)
- Iterations: 100,000
- Salt: 16 bytes, randomly generated per password via `crypto.getRandomValues()`
- Key length: 32 bytes (256 bits)
- Storage format: `base64(salt):base64(hash)`
- Comparison: Constant-time via HMAC sign + XOR (prevents timing attacks)

### 5.2 Token Rotation & Replay Detection

**File:** `apps/api/src/lib/refresh-token.ts`

- Each refresh token is single-use: on rotation, the old token is revoked and a new one is created
- Tokens belong to a "family" (identified by `family_id` UUID)
- **Grace period:** 2 seconds — if a revoked token is reused within 2 seconds, it's allowed (handles concurrent requests / network retries)
- **Replay detection:** If a revoked token is reused AFTER the grace period, the ENTIRE family is revoked (all sessions in that family). This indicates token theft — either the attacker or the legitimate user is replaying a stolen token
- Token storage: only the SHA-256 hash is stored in D1 (never the raw token)

### 5.3 Cookie Security

- `httpOnly: true` — JavaScript cannot access the cookie (XSS protection)
- `secure: true` — Only sent over HTTPS (production)
- `sameSite: 'None'` — Required for cross-origin delivery (API on different subdomain)
- Refresh token restricted to `/auth/refresh` path — never sent on regular API calls
- No explicit `domain` — cookies are per-origin (no cross-subdomain sharing)

### 5.4 Rate Limiting

**File:** `apps/api/src/middleware/rate-limit.ts`

Rate limits are enforced per-IP (unauthenticated) or per-user (authenticated) via KV counters:

| Tier | Max Requests | Window |
|------|-------------|--------|
| `auth` | 10/min | 60s |
| `api` | 100/min | 60s |
| `webhook` | 200/min | 60s |
| `admin` | 50/min | 60s |

All auth endpoints (`/auth/*`) use the `auth` tier (10 req/min). Rate limit headers are set on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` (on 429).

KV counter increments use `waitUntil` for non-blocking writes.

### 5.5 OAuth Security

- State parameter: random UUID, stored in KV with 10-minute TTL, consumed (deleted) on use — prevents CSRF
- External fetch timeout: 10 seconds via `AbortController` — prevents hanging on provider outages
- GitHub scopes: `read:user user:email` (minimal)
- Google scopes: `openid email profile` (minimal)

### 5.6 Anti-Enumeration

- `POST /auth/forgot-password` always returns success regardless of whether the email exists
- `POST /auth/login` returns the same error message for wrong email and wrong password

### 5.7 Audit Trail

Every auth mutation logs an audit event via `insertAuditEvent()` with hash chain integrity:

| Action | When |
|--------|------|
| `auth.signup` | User registers |
| `auth.login` | User logs in |
| `auth.logout` | User logs out |
| `auth.password_reset` | Password reset completed |
| `auth.password_changed` | Password changed |
| `auth.email_verified` | Email verified via OTP |
| `auth.account_deleted` | Account deletion confirmed |

---

## 6. Database Schema

### 6.1 `users` Table

**File:** `packages/db/src/schema/users.ts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `email` | text UNIQUE NOT NULL | Lowercase, validated |
| `name` | text | Display name |
| `password_hash` | text | PBKDF2 hash, null for OAuth-only accounts |
| `github_id` | integer UNIQUE | GitHub OAuth user ID |
| `github_username` | text | GitHub login |
| `google_id` | text UNIQUE | Google OAuth user ID |
| `avatar_url` | text | Profile image URL |
| `password_must_change` | integer NOT NULL DEFAULT 0 | 1 = forced change (judge temp passwords) |
| `email_verified` | integer NOT NULL DEFAULT 0 | 0/1 boolean (DB column exists but currently unused — verification stored in KV) |
| `email_bounced` | integer NOT NULL DEFAULT 0 | Email delivery failure flag |
| `suspended` | integer NOT NULL DEFAULT 0 | Account suspension flag |
| `suspended_at` | text | ISO-8601 timestamp |
| `suspended_reason` | text | Free-text reason |
| `last_login_at` | text | Updated on each login |
| `created_at` | text NOT NULL | ISO-8601, auto-generated |
| `updated_at` | text NOT NULL | ISO-8601, auto-generated |

**Indexes:** `email` (unique), `github_id` (unique), `google_id` (unique), `github_username`

### 6.2 `refresh_tokens` Table

**File:** `packages/db/src/schema/refresh-tokens.ts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `user_id` | text FK → users.id (CASCADE) | Token owner |
| `token_hash` | text UNIQUE NOT NULL | SHA-256 hash of the raw token |
| `family_id` | text NOT NULL | Groups tokens from the same session |
| `expires_at` | text NOT NULL | ISO-8601, 30 days from creation |
| `revoked` | integer DEFAULT 0 | Legacy flag (unused — `revoked_at` is authoritative) |
| `revoked_at` | text | ISO-8601 timestamp of revocation |
| `replaced_by` | text | ID of successor token (unused currently) |
| `ip_address` | text | Client IP (not populated currently) |
| `user_agent` | text | Client user agent (not populated currently) |
| `created_at` | text NOT NULL | ISO-8601 |

**Indexes:** `token_hash` (unique), `user_id`, `family_id`, `expires_at`

### 6.3 `platform_admins` Table

**File:** `packages/db/src/schema/platform-admins.ts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `user_id` | text UNIQUE FK → users.id (CASCADE) | Admin user |
| `added_by` | text FK → users.id (SET NULL) | Who granted admin |
| `created_at` | text NOT NULL | ISO-8601 |

### 6.4 `otp_sessions` Table

**File:** `packages/db/src/schema/otp-sessions.ts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `user_id` | text FK → users.id (CASCADE) | |
| `otp_hash` | text NOT NULL | SHA-256 hash of OTP |
| `ip_address` | text | Client IP |
| `user_agent` | text | Client user agent |
| `attempts` | integer DEFAULT 0 | Failed verification attempts |
| `max_attempts` | integer DEFAULT 5 | Maximum allowed attempts |
| `created_at` | text NOT NULL | ISO-8601 |
| `expires_at` | text NOT NULL | ISO-8601 |
| `verified_at` | text | Set on successful verification |

> **Note:** The DB table exists but is NOT currently used by the auth routes. OTP storage is done in KV instead (`email_otp:{userId}`). See Known Issues.

### 6.5 `email_verification_tokens` Table

**File:** `packages/db/src/schema/otp-sessions.ts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `user_id` | text FK → users.id (CASCADE) | |
| `token_hash` | text UNIQUE NOT NULL | |
| `created_at` | text NOT NULL | |
| `expires_at` | text NOT NULL | |
| `used_at` | text | Set when token is consumed |

> **Note:** This table exists in the schema but is NOT exported from `packages/db/src/schema/index.ts` and is NOT used by any auth routes. See Known Issues.

### 6.6 `password_reset_tokens` Table

**File:** `packages/db/src/schema/otp-sessions.ts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `user_id` | text FK → users.id (CASCADE) | |
| `token_hash` | text UNIQUE NOT NULL | |
| `created_at` | text NOT NULL | |
| `expires_at` | text NOT NULL | |
| `used_at` | text | Set when token is consumed |

> **Note:** Same as above — table exists but password reset uses KV storage instead. See Known Issues.

### 6.7 `deletion_requests` Table

Referenced in auth routes but schema file not found in `packages/db/src/schema/`. Created via migration.

### 6.8 Better Auth Schema Tables (Unused)

The following tables exist in the schema directory but are part of an abandoned Better Auth integration. They are NOT used by any production code:

- `user` (auth-user.ts) — separate from `users`
- `session` (auth-session.ts)
- `account` (auth-account.ts)
- `verification` (auth-verification.ts)
- `passkey` (auth-passkey.ts)
- `two_factor` (auth-two-factor.ts)

These should be cleaned up. See Known Issues.

### 6.9 Entity Relationship (Auth Tables)

```
users
 ├──< refresh_tokens     (user_id FK, CASCADE)
 ├──< otp_sessions        (user_id FK, CASCADE) [unused]
 ├──< email_verification_tokens (user_id FK, CASCADE) [unused]
 ├──< password_reset_tokens     (user_id FK, CASCADE) [unused]
 ├──< platform_admins     (user_id FK, CASCADE)
 ├──< organizer_roles     (user_id) — hackathon role assignments
 ├──< judges              (user_id) — judge invitations
 ├──< team_members        (user_id) — team participation
 └──< workspace_members   (user_id) — workspace access
```

---

## 7. Frontend Integration

### 7.1 Overview by App

| App | Auth Context | Protected Routes | apiRequest | Vite Proxy for `/auth` |
|-----|-------------|-----------------|------------|----------------------|
| `apps/web` | ❌ None | ❌ None | ❌ Missing `credentials: 'include'` | ❌ Not configured |
| `apps/platform` | ✅ `AuthProvider` | ✅ `ProtectedRoute` (isOrganizer) | ✅ With auto-refresh | ✅ Configured |
| `apps/admin` | ✅ `AuthProvider` | ✅ `ProtectedRoute` (isPlatformAdmin) | ✅ With auto-refresh | ✅ Configured |
| `apps/judge` | ✅ `AuthProvider` | ✅ `ProtectedRoute` (isJudge) | ✅ With auto-refresh | ✅ Configured |

### 7.2 Auth Context Pattern

**File:** `apps/{platform,admin,judge}/src/contexts/auth-context.tsx`

All three apps follow the same pattern:

```typescript
// On mount: call GET /auth/me to check session
// If authenticated: set user state, roles, flags
// If unauthenticated: clear state

// Provides:
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // App-specific:
  isPlatformAdmin: boolean;   // admin, platform
  isOrganizer: boolean;       // platform
  isJudge: boolean;           // judge
  passwordMustChange: boolean; // judge
  hackathonRoles: Record<string, string[]>;
  workspaceRoles: Record<string, string>;
  refreshToken: () => Promise<string | null>;
  logout: () => Promise<void>;
}
```

**Initialization:** On mount, calls `GET /auth/me`. If it returns user data, sets `isAuthenticated = true`. If it fails (401), user remains `null`.

**Logout:** Calls `POST /auth/logout`, clears all state, redirects to `/login`.

**Judge-specific:** If `password_must_change` is `true`, automatically redirects to `/change-password`.

### 7.3 API Request with Auto-Refresh

**File:** `apps/{platform,admin,judge}/src/lib/api.ts`

```
API Call
  │
  ├─ Send request with credentials: 'include'
  │
  ├─ Response 401?
  │    ├─ Is this /auth/me or /auth/refresh? → throw (don't retry)
  │    ├─ Call POST /auth/refresh (credentials: 'include')
  │    │    ├─ Success? → Retry original request
  │    │    └─ Failure? → Redirect to /login
  │    └─ Return retried response
  │
  └─ Response OK → return JSON
```

Key implementation details:
- `credentials: 'include'` on every request — sends auth cookies cross-origin
- 401 auto-refresh avoids `/auth/me` and `/auth/refresh` to prevent infinite loops
- On refresh failure, redirects to `/login` (unless already there)
- `Content-Type: application/json` set by default

### 7.4 Protected Route Components

**File:** `apps/{platform,admin,judge}/src/components/protected-route.tsx`

Each app has a `ProtectedRoute` component that wraps routes requiring authentication:

```
isLoading? → Show spinner
!isAuthenticated? → Navigate to /login (with return location)
!hasRequiredRole? → Show AccessDenied page
All checks pass → Render <Outlet />
```

Role checks per app:
- **Admin:** `isPlatformAdmin`
- **Platform:** `isOrganizer`
- **Judge:** `isJudge`

The AccessDenied component shows the signed-in user's name and a sign-out button.

### 7.5 Vite Dev Proxy

For local development, Vite proxies auth requests to the API Worker:

```typescript
// apps/platform/vite.config.ts (and admin, judge)
server: {
  proxy: {
    '/api/v1': { target: 'http://localhost:8787', changeOrigin: true },
    '/auth':   { target: 'http://localhost:8787', changeOrigin: true },
  }
}
```

> **Note:** `apps/web` does NOT proxy `/auth` — only `/api/v1`, `/hackathons`, `/webhooks`.

---

## 8. Configuration

### 8.1 Required Secrets (API Worker)

| Secret | Purpose | Where Set |
|--------|---------|-----------|
| `JWT_SECRET` | HMAC signing key for access JWTs | `wrangler secret put` / `.dev.vars` |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | `wrangler secret put` / `.dev.vars` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret | `wrangler secret put` / `.dev.vars` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `wrangler secret put` / `.dev.vars` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `wrangler secret put` / `.dev.vars` |
| `SMTP_URL` | SMTP server URL for email delivery | `wrangler secret put` / `.dev.vars` |
| `SMTP_USERNAME` | SMTP authentication username | `wrangler secret put` / `.dev.vars` |
| `SMTP_PASSWORD` | SMTP authentication password | `wrangler secret put` / `.dev.vars` |
| `SMTP_EMAIL_ADDR` | From address for emails (optional) | `wrangler secret put` / `.dev.vars` |

### 8.2 Required Environment Variables (API Worker)

Set in `wrangler.jsonc` `[vars]`:

| Variable | Example | Purpose |
|----------|---------|---------|
| `FRONTEND_URL` | `https://devsage.org` | Web app origin (CORS + OAuth redirects) |
| `PLATFORM_URL` | `https://platform.devsage.org` | Platform app origin |
| `ADMIN_URL` | `https://shikdd.devsage.org` | Admin app origin |
| `JUDGE_URL` | `https://judge.devsage.org` | Judge app origin |
| `API_URL` | `https://api.devsage.org` | API self-URL |
| `EMAIL_FROM` | `noreply@devsage.org` | Email sender address |
| `HACKATHON_ORIGIN_PATTERN` | `https://*.hackathon.devsage.org` | Wildcard CORS for hackathon sites |
| `PAGES_ORIGIN_PATTERN` | `https://*.pages.dev` | Wildcard CORS for CF Pages preview |

### 8.3 Required Bindings (API Worker)

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 Database | User data, tokens, roles |
| `KV` | KV Namespace | OAuth state, OTP, rate limit counters, role cache, email verification |

### 8.4 Frontend Environment Variables

| Variable | Purpose | Apps |
|----------|---------|------|
| `VITE_API_URL` or `VITE_API_ORIGIN` | API base URL (production only) | platform, admin, judge |

In development, the Vite proxy handles routing so no API origin is needed.

---

## 9. Known Issues & Gaps

### Critical

1. **`apps/web` has no auth implementation** — No AuthProvider, no `credentials: 'include'` in apiRequest, no `/auth` proxy in Vite config. The web app is currently public-only. (Ref: `COMPREHENSIVE-DEBT-AUDIT.md` WEB-032, WEB-033, WEB-034, WEB-035)

2. **Email verification stored in KV only, not D1** — The `email_verified` column exists on the `users` table but is never set. Verification is stored in KV (`email_verified:{userId}`), which is eventually consistent and not queryable. (Ref: `COMPREHENSIVE-DEBT-AUDIT.md` API-012)

3. **TOTP 2FA not implemented** — The DB schema for `two_factor` exists (backup codes, secrets) but there are no API endpoints or UI for enrollment, verification, or recovery. (Ref: `plan-gaps.md` GAP-002)

### High

4. **Account deletion cascade incomplete** — The `DELETE FROM users` relies on `ON DELETE CASCADE` for some tables, but manually handles `workspaces`, `hackathons`, `scores`, `judge_assignments`. Other tables with user references (e.g., `submissions`, `announcements`, `audit_events`) may leave orphaned records. (Ref: `COMPREHENSIVE-DEBT-AUDIT.md` API-013)

5. **Deletion request has no expiry** — The confirmation token created by `POST /auth/delete-account` has no TTL. A pending deletion request never expires and there's no limit on how many pending requests a user can create. (Ref: `COMPREHENSIVE-DEBT-AUDIT.md` API-014)

6. **Better Auth schema tables are dead code** — 6 schema files (`auth-user.ts`, `auth-session.ts`, `auth-account.ts`, `auth-verification.ts`, `auth-passkey.ts`, `auth-two-factor.ts`) are remnants of an abandoned Better Auth integration. They reference a separate `user` table (not `users`) and are not exported or used. Should be removed. (Ref: `cleanup.md`)

7. **3 auth schema tables not exported** — `otpSessions`, `emailVerificationTokens`, and `passwordResetTokens` from `otp-sessions.ts` are not exported from `packages/db/src/schema/index.ts`. (Ref: `COMPREHENSIVE-DEBT-AUDIT.md` PKG-001, PKG-002)

### Medium

8. **`refresh_tokens.ip_address` and `user_agent` never populated** — The schema has columns for IP and user agent tracking but `createRefreshToken()` doesn't pass them.

9. **No CSRF protection beyond SameSite cookies** — The system relies on `SameSite: None` (required for cross-origin) which provides NO CSRF protection. There is no separate CSRF token mechanism.

10. **Password reset tokens stored in KV, not D1** — The `password_reset_tokens` table exists but is unused. Reset tokens are stored in KV, which is simpler but loses queryability and auditability.

11. **OTP stored in KV, not D1** — Same issue as email verification. The `otp_sessions` table exists but is unused.

### Low

12. **Auth test coverage is zero** — 19 auth endpoints have no integration tests. Marked as HIGH priority in `missing-tests.md`.

13. **Migration 0002 (add `password_must_change`) not registered** in the Drizzle migration journal. (Ref: `COMPREHENSIVE-DEBT-AUDIT.md` PKG-035)

---

## 10. Future Improvements

### Priority 1 — Security & Correctness

- [ ] **Migrate OTP, email verification, and password reset from KV to D1** — Use the existing DB tables (`otp_sessions`, `email_verification_tokens`, `password_reset_tokens`). Export them from the schema index.
- [ ] **Add deletion request expiry** — 24-hour TTL, max 1 pending request per user.
- [ ] **Complete account deletion cascade** — Audit all tables with user_id foreign keys and handle them explicitly.
- [ ] **Add CSRF token mechanism** — Generate and validate CSRF tokens for state-changing requests, since `SameSite: None` doesn't prevent CSRF.
- [ ] **Populate `ip_address` and `user_agent`** on refresh token records for session management UI.
- [ ] **Clean up Better Auth schema files** — Remove the 6 unused `auth-*.ts` schema files and the `user`/`session`/`account`/`verification`/`passkey`/`two_factor` tables.

### Priority 2 — Features

- [ ] **TOTP 2FA** — Implement enrollment (`POST /auth/2fa/enroll`), verification (`POST /auth/2fa/verify`), and recovery (`POST /auth/2fa/recover`). DB schema already exists.
- [ ] **Implement web app auth** — Add AuthProvider, protected routes, and `credentials: 'include'` to `apps/web`. Add `/auth` to Vite proxy.
- [ ] **Session management UI** — Use `GET /auth/sessions` and `DELETE /auth/sessions/:familyId` to build a "manage active sessions" page showing device/IP/last active.
- [ ] **Email verification gating** — Require verified email before certain actions (e.g., creating a hackathon, joining a team).
- [ ] **Passkey/WebAuthn support** — DB schema for `passkey` already exists. Implement enrollment and authentication flows.

### Priority 3 — Hardening

- [ ] **Write auth integration tests** — Cover all 19 endpoints with `@cloudflare/vitest-pool-workers`.
- [ ] **Add account lockout** — After N failed login attempts, temporarily lock the account.
- [ ] **Improve rate limiting** — Add sliding window or token bucket algorithm (current fixed-window has burst issues at window boundaries).
- [ ] **Add refresh token device fingerprinting** — Associate tokens with device characteristics to detect token theft across devices.
- [ ] **Register migration 0002** in Drizzle journal.

---

## Appendix A: Complete Endpoint Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | None | Create account (email/password) |
| POST | `/auth/login` | None | Login (email/password) |
| GET | `/auth/google` | None | Start Google OAuth flow |
| GET | `/auth/callback/google` | None | Google OAuth callback |
| GET | `/auth/github` | None | Start GitHub OAuth flow |
| GET | `/auth/callback/github` | None | GitHub OAuth callback |
| POST | `/auth/refresh` | Refresh cookie | Rotate tokens |
| POST | `/auth/logout` | Required | End session |
| GET | `/auth/me` | Required | Get current user + roles |
| GET | `/auth/sessions` | Required | List active sessions |
| DELETE | `/auth/sessions/:familyId` | Required | Revoke specific session |
| DELETE | `/auth/sessions` | Required | Revoke all sessions |
| POST | `/auth/forgot-password` | None | Request password reset email |
| POST | `/auth/reset-password` | None | Execute password reset |
| POST | `/auth/change-password` | Required | Change password (current + new) |
| POST | `/auth/send-verification` | Required | Send OTP email |
| POST | `/auth/verify-email` | Required | Verify OTP |
| POST | `/auth/delete-account` | Required | Request account deletion |
| POST | `/auth/delete-account/confirm` | Required | Confirm account deletion |

**Rate limiting:** All endpoints use the `auth` tier — 10 requests per minute per IP/user.

## Appendix B: Source File Index

| File | Purpose |
|------|---------|
| `apps/api/src/routes/auth.ts` | All 19 auth route handlers |
| `apps/api/src/lib/jwt.ts` | JWT sign/verify (HMAC SHA-256) |
| `apps/api/src/lib/refresh-token.ts` | Token creation, rotation, revocation, replay detection |
| `apps/api/src/lib/password.ts` | PBKDF2-SHA256 password hashing + constant-time comparison |
| `apps/api/src/lib/cookies.ts` | Cookie get/set/clear helpers |
| `apps/api/src/lib/oauth.ts` | OAuth state management, provider URL builders, token exchange, profile fetch |
| `apps/api/src/lib/user-service.ts` | GitHub user upsert, Google user link, callback URL builder |
| `apps/api/src/lib/allowed-origin.ts` | CORS origin matching (static + wildcard patterns) |
| `apps/api/src/middleware/auth.ts` | `optionalAuth` (global) + `authMiddleware` (per-route) |
| `apps/api/src/middleware/role.ts` | `resolveRole()`, `requireRole()`, `requireExactRole()` |
| `apps/api/src/middleware/platform-admin.ts` | `requirePlatformAdmin` middleware |
| `apps/api/src/middleware/rate-limit.ts` | KV-based rate limiting per tier |
| `apps/api/src/types/env.ts` | `AppEnv`, `UserContext`, `HackathonRole` type definitions |
| `apps/api/src/types/auth.ts` | `JWTPayload` interface |
| `packages/db/src/schema/users.ts` | Users table schema |
| `packages/db/src/schema/refresh-tokens.ts` | Refresh tokens table schema |
| `packages/db/src/schema/platform-admins.ts` | Platform admins table schema |
| `packages/db/src/schema/otp-sessions.ts` | OTP, email verification, password reset token schemas |
| `apps/{platform,admin,judge}/src/contexts/auth-context.tsx` | Frontend auth state management |
| `apps/{platform,admin,judge}/src/lib/api.ts` | API client with 401 auto-refresh |
| `apps/{platform,admin,judge}/src/components/protected-route.tsx` | Route guards with role checks |
