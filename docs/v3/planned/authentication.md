# Authentication & Sessions

> Complete specification for DevSage v3 authentication. Covers OAuth 2.0 (GitHub + Google), dual-token architecture (short-lived access + rotating refresh), passkey/WebAuthn, TOTP-based MFA, session management, account lifecycle, and GDPR compliance. Built entirely on Web Crypto APIs — no external auth libraries.

---

## Table of Contents

- [Design Goals](#design-goals)
- [Auth Providers](#auth-providers)
- [OAuth 2.0 Flows](#oauth-20-flows)
- [Account Linking](#account-linking)
- [Token Architecture](#token-architecture)
- [Cookie Strategy](#cookie-strategy)
- [Auth Middleware](#auth-middleware)
- [Frontend Auth Flow](#frontend-auth-flow)
- [Logout](#logout)
- [Passkey / WebAuthn](#passkey--webauthn)
- [Multi-Factor Authentication (TOTP)](#multi-factor-authentication-totp)
- [Session Management](#session-management)
- [OAuth Scope Expansion](#oauth-scope-expansion)
- [Rate Limiting](#rate-limiting)
- [Account Deletion & GDPR](#account-deletion--gdpr)
- [Error Code Catalog](#error-code-catalog)
- [Security Threat Model](#security-threat-model)
- [Edge Cases](#edge-cases)
- [Database Tables](#database-tables)
- [Migration from v2](#migration-from-v2)
- [Feature Dependency Graph](#feature-dependency-graph)
- [Decision Log](#decision-log)

---

## Design Goals

| Goal | Description |
|------|-------------|
| **Zero external auth libraries** | All cryptography via `crypto.subtle` (Web Crypto API). No JWT libraries, no passport.js, no `@hono/oauth-providers`. Cloudflare Workers runtime only. |
| **Short-lived access tokens** | Access tokens expire in 15 minutes. Limits blast radius of stolen tokens. |
| **Rotating refresh tokens** | Single-use refresh tokens with family-based replay detection. Compromised refresh tokens trigger full revocation. |
| **Passwordless-first** | Primary auth via OAuth (GitHub/Google) or passkeys. No password database. |
| **Per-request role resolution** | Roles are never baked into tokens. Resolved from the database on every request, per hackathon. |
| **Multi-device session visibility** | Users can see and revoke all active sessions from a settings page. |
| **GDPR compliance** | Full data export and account deletion with cascading cleanup. |

---

## Auth Providers

DevSage supports three authentication methods. GitHub is required for full platform functionality because the bot features (commit tracking, PR comments, submission capture) depend on a linked GitHub account.

| Provider | Role | Required? | When Available |
|----------|------|-----------|----------------|
| GitHub OAuth 2.0 | Primary identity + bot features | Yes (for full access) | Launch |
| Google OAuth 2.0 | Convenience login | No | Launch |
| Passkey / WebAuthn | Passwordless, phishing-resistant | No | Post-launch |

Users who sign in with Google without a linked GitHub account have limited access — they cannot join teams, submit, or use any GitHub-dependent features. They are prompted to link a GitHub account.

---

## OAuth 2.0 Flows

### GitHub OAuth (Primary)

```mermaid
sequenceDiagram
    participant U as User Browser
    participant W as API Worker
    participant KV as Workers KV
    participant GH as GitHub OAuth
    participant D1 as D1 Database

    U->>W: GET /auth/github?origin=https://devsage.org
    W->>W: Generate cryptographically random state (32 bytes, hex-encoded)
    W->>KV: PUT state → { origin } with 10-minute TTL
    W->>U: 302 → github.com/login/oauth/authorize<br/>client_id, redirect_uri=/auth/callback/github,<br/>scope=read:user user:email, state

    U->>GH: User reviews and authorizes
    GH->>U: 302 → /auth/callback/github?code=...&state=...

    U->>W: GET /auth/callback/github?code=...&state=...
    W->>KV: GET state → validate exists, consume (delete after read)
    KV-->>W: { origin } or null

    alt State missing or mismatched
        W->>U: 401 INVALID_STATE
    end

    W->>GH: POST github.com/login/oauth/access_token<br/>client_id, client_secret, code
    GH-->>W: { access_token, token_type }

    alt Code exchange fails
        W->>U: 401 OAUTH_FAILED
    end

    W->>GH: GET api.github.com/user<br/>Authorization: Bearer {access_token}
    GH-->>W: { id, login, name, email, avatar_url }

    W->>D1: Upsert user by github_id<br/>Update login, name, email, avatar_url, last_login_at
    D1-->>W: User record (id, github_id, google_id, ...)

    W->>W: Create token family (random family_id)
    W->>W: Sign access token (15-min expiry)
    W->>W: Sign refresh token (30-day expiry)
    W->>D1: Insert token family record

    alt User has MFA enabled
        W->>U: Set-Cookie: mfa_pending=<temp_token><br/>302 → /auth/mfa-challenge
    else No MFA
        W->>U: Set-Cookie: access_token + refresh_token<br/>302 → {origin}/auth/callback
    end
```

**GitHub OAuth parameters:**

| Parameter | Value |
|-----------|-------|
| Authorization URL | `https://github.com/login/oauth/authorize` |
| Token URL | `https://github.com/login/oauth/access_token` |
| Scopes (login) | `read:user`, `user:email` |
| Scopes (bot, incremental) | `repo`, `admin:repo_hook` (see [OAuth Scope Expansion](#oauth-scope-expansion)) |
| Redirect URI | `/auth/callback/github` |
| State storage | Workers KV, 10-minute TTL, consumed on use |

**Why GitHub is required:** DevSage's core value prop is GitHub-native hackathon management. The bot tracks commits, detects force pushes, captures tag-based submissions, and comments on PRs. All of this requires a linked `github_id`. Without it, the user is essentially read-only.

### Google OAuth (Secondary)

```mermaid
sequenceDiagram
    participant U as User Browser
    participant W as API Worker
    participant KV as Workers KV
    participant GO as Google OAuth
    participant D1 as D1 Database

    U->>W: GET /auth/google?origin=https://devsage.org
    W->>W: Generate cryptographically random state (32 bytes, hex-encoded)
    W->>KV: PUT state → { origin } with 10-minute TTL
    W->>U: 302 → accounts.google.com/o/oauth2/v2/auth<br/>client_id, redirect_uri=/auth/callback/google,<br/>scope=openid profile email, state,<br/>response_type=code, access_type=offline

    U->>GO: User reviews and authorizes
    GO->>U: 302 → /auth/callback/google?code=...&state=...

    U->>W: GET /auth/callback/google?code=...&state=...
    W->>KV: GET state → validate exists, consume (delete after read)
    KV-->>W: { origin } or null

    alt State missing or mismatched
        W->>U: 401 INVALID_STATE
    end

    W->>GO: POST oauth2.googleapis.com/token<br/>client_id, client_secret, code, grant_type=authorization_code
    GO-->>W: { access_token, id_token, ... }

    alt Code exchange fails
        W->>U: 401 OAUTH_FAILED
    end

    W->>W: Decode id_token (JWT) to extract { sub, email, name, picture }
    Note over W: Alternatively: GET googleapis.com/oauth2/v2/userinfo

    W->>D1: Look up user by google_id
    alt Existing user with google_id
        D1-->>W: User record
    else No user with this google_id
        W->>D1: Check if email matches existing user
        alt Email matches existing user
            W->>D1: Set google_id on existing user
        else Brand new user
            W->>D1: Insert new user (google_id set, github_id = null)
        end
        D1-->>W: User record
    end

    W->>W: Create token family, sign access + refresh tokens

    alt User has MFA enabled
        W->>U: Set-Cookie: mfa_pending<br/>302 → /auth/mfa-challenge
    else User has github_id
        W->>U: Set-Cookie: access_token + refresh_token<br/>302 → {origin}/auth/callback
    else User has NO github_id
        W->>U: Set-Cookie: access_token + refresh_token<br/>302 → {origin}/link-required
    end
```

**Google OAuth parameters:**

| Parameter | Value |
|-----------|-------|
| Authorization URL | `https://accounts.google.com/o/oauth2/v2/auth` |
| Token URL | `https://oauth2.googleapis.com/token` |
| Scopes | `openid`, `profile`, `email` |
| Profile extraction | Decode `id_token` JWT payload (preferred) or call `/oauth2/v2/userinfo` |
| Redirect URI | `/auth/callback/google` |
| State storage | Workers KV, 10-minute TTL, consumed on use |

---

## Account Linking

Users who sign in with Google but have no GitHub account linked are redirected to `/link-required`. They have limited access until they link GitHub.

```mermaid
flowchart TD
    A[Google OAuth callback] --> B{User has github_id?}
    B -->|Yes| C{MFA enabled?}
    C -->|Yes| D[Set mfa_pending cookie → /auth/mfa-challenge]
    C -->|No| E[Set access + refresh cookies → /dashboard]
    B -->|No| F[Set access + refresh cookies → /link-required]
    F --> G["User clicks 'Link GitHub Account'"]
    G --> H[GitHub OAuth flow with link_mode=true in state]
    H --> I[Callback detects link_mode → merge accounts]
    I --> J[Set github_id on existing user record]
    J --> E
```

**Merge rules:**
- The existing user record (created via Google) is the canonical record. Its `id` (UUID) is preserved.
- `github_id`, `github_username`, and `avatar_url` are set from the GitHub profile.
- If a different user already exists with that `github_id` (they signed up with GitHub before), the two accounts are merged: the GitHub-only record is deleted, and any team memberships, scores, or audit events are re-pointed to the Google-originated user ID.
- Merge conflicts (both accounts are team leaders in the same hackathon) block the link and surface an error: `ACCOUNT_MERGE_CONFLICT`.

---

## Token Architecture

v3 replaces the single long-lived JWT with a dual-token system: a short-lived access token for API authentication and a rotating refresh token for session continuity.

### Access Token

A stateless JWT used on every API request. Short-lived to limit exposure.

```typescript
interface AccessTokenPayload {
  sub: string;    // user.id (UUID)
  ghid: number;   // github_id (0 if not linked)
  ghu: string;    // github_username ("" if not linked)
  fam: string;    // token family ID (links to refresh token family)
  iat: number;    // issued at (Unix seconds)
  exp: number;    // expiry (Unix seconds) — iat + 900
}
```

| Property | Value |
|----------|-------|
| Algorithm | HMAC-SHA256 via `crypto.subtle` |
| Secret | `JWT_SECRET` environment variable |
| Expiry | 15 minutes (900 seconds) |
| Cookie | `access_token`, HttpOnly, path `/` |
| Server-side state | None — fully stateless |
| Verification cost | ~0.5ms CPU |

### Refresh Token

An opaque token (not a JWT) stored server-side. Single-use — every refresh issues a new pair and invalidates the old one.

```typescript
interface RefreshToken {
  token: string;         // crypto.randomUUID() — opaque, not a JWT
  family_id: string;     // groups all tokens from one login session
  user_id: string;       // owner
  token_hash: string;    // SHA-256 hash of token (stored, not the raw token)
  expires_at: string;    // ISO-8601, 30 days from issuance
  used_at: string | null;    // set when consumed during refresh
  revoked_at: string | null; // set on explicit revocation or replay detection
  created_at: string;    // ISO-8601
}
```

| Property | Value |
|----------|-------|
| Format | Opaque UUID (not a JWT) |
| Storage | Hashed (SHA-256) in `token_families` table in D1 |
| Expiry | 30 days |
| Cookie | `refresh_token`, HttpOnly, path `/auth/refresh` only |
| Rotation | Every use issues a new refresh token |
| Replay detection | Reuse of a consumed token revokes the entire family |

### What is NOT in the Access Token

- **Roles** — resolved per-request per-hackathon via database query (see roles-permissions doc)
- **Email** — may change; always fetched from DB when needed
- **Display name** — may change; always fetched from DB when needed
- **Permissions** — derived from roles at request time
- **MFA status** — checked during login flow, not on every request

**Why 15-minute access tokens?** Short enough that a stolen token has limited utility (attacker has at most 15 minutes). Long enough that most user sessions (clicking through pages, filling forms) never hit a refresh boundary. The 15-minute window also means a compromised token cannot be used indefinitely even if the refresh token is not compromised.

**Why opaque refresh tokens (not JWTs)?** Refresh tokens must be revocable server-side (for session management, logout, replay detection). Making them stateless JWTs would defeat the purpose — you'd need a revocation list anyway. An opaque token with a server-side hash is simpler and equally secure.

### Token Lifecycle

```mermaid
flowchart TD
    A[User completes OAuth + MFA] --> B[Worker creates token family]
    B --> C[Sign access token — 15-min expiry]
    B --> D[Generate refresh token — 30-day expiry]
    C --> E[Set access_token cookie — path /]
    D --> F[Set refresh_token cookie — path /auth/refresh]

    E --> G[User makes API requests]
    G --> H{Access token valid?}
    H -->|Yes| I[Process request]
    H -->|Expired| J[Frontend receives 401 TOKEN_EXPIRED]

    J --> K[Frontend calls POST /auth/refresh]
    K --> L{Refresh token valid and unused?}
    L -->|Yes| M[Issue new access + refresh tokens]
    M --> N[Mark old refresh token as used]
    N --> G

    L -->|Token already used — replay| O[Revoke entire token family]
    O --> P[401 REFRESH_TOKEN_REUSED — force re-login]

    L -->|Token expired| Q[401 REFRESH_TOKEN_EXPIRED — force re-login]
    L -->|Token revoked| R[401 SESSION_REVOKED — force re-login]
```

### Refresh Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant W as API Worker
    participant D1 as D1 Database

    U->>W: API request with expired access token
    W->>W: Verify access token → expired
    W->>U: 401 TOKEN_EXPIRED

    U->>W: POST /auth/refresh<br/>Cookie: refresh_token=...
    W->>W: Hash the refresh token (SHA-256)
    W->>D1: SELECT * FROM token_families<br/>WHERE token_hash = {hash}

    alt Token not found
        W->>U: 401 INVALID_REFRESH_TOKEN
    else Token found but used_at is set (replay)
        W->>D1: UPDATE token_families<br/>SET revoked_at = now()<br/>WHERE family_id = {family_id}
        W->>U: 401 REFRESH_TOKEN_REUSED
        Note over U: All sessions in this family are killed
    else Token found but expired
        W->>U: 401 REFRESH_TOKEN_EXPIRED
    else Token found but revoked
        W->>U: 401 SESSION_REVOKED
    else Token valid
        W->>D1: UPDATE SET used_at = now() on old token
        W->>W: Generate new refresh token
        W->>D1: INSERT new token in same family
        W->>W: Sign new access token (15-min)
        W->>U: Set-Cookie: access_token + refresh_token
    end
```

---

## Cookie Strategy

All tokens are stored in HttpOnly cookies. JavaScript never touches tokens directly.

### Production

| Cookie | Value | HttpOnly | Secure | SameSite | Path | MaxAge | Domain |
|--------|-------|----------|--------|----------|------|--------|--------|
| `access_token` | Signed JWT | Yes | Yes | `Strict` | `/` | 900 (15 min) | `.devsage.org` |
| `refresh_token` | Opaque UUID | Yes | Yes | `Strict` | `/auth/refresh` | 2592000 (30 days) | `.devsage.org` |
| `mfa_pending` | Temporary JWT | Yes | Yes | `Strict` | `/auth/mfa` | 300 (5 min) | `.devsage.org` |

### Development

| Cookie | Value | HttpOnly | Secure | SameSite | Path | MaxAge | Domain |
|--------|-------|----------|--------|----------|------|--------|--------|
| `access_token` | Signed JWT | Yes | No | `Lax` | `/` | 900 | *(omitted — defaults to localhost)* |
| `refresh_token` | Opaque UUID | Yes | No | `Lax` | `/auth/refresh` | 2592000 | *(omitted)* |
| `mfa_pending` | Temporary JWT | Yes | No | `Lax` | `/auth/mfa` | 300 | *(omitted)* |

**Why `SameSite=Strict` in production but `Lax` in development?** In production, both the frontend (`devsage.org`) and the OAuth callback (`api.devsage.org/auth/callback/...`) share the `.devsage.org` domain — so the redirect from GitHub/Google back to our callback is same-site and `Strict` works. In development, GitHub redirects to `localhost`, which is a different site from `github.com` — `Strict` would block the cookie from being sent on the redirect, so `Lax` is needed.

**Why separate paths for refresh and access cookies?** The refresh token cookie has `path: /auth/refresh`, so it is only sent on refresh requests. This means a compromised endpoint elsewhere in the API cannot extract the refresh token — it is never present in those requests.

---

## Auth Middleware

### `authMiddleware` (strict)

Required on all protected routes. Extracts and validates the access token. Rejects unauthenticated requests.

```mermaid
flowchart LR
    A[Request] --> B{access_token cookie present?}
    B -->|No| C[401 NO_TOKEN]
    B -->|Yes| D{JWT signature valid?}
    D -->|No| E[401 INVALID_TOKEN]
    D -->|Yes| F{JWT expired?}
    F -->|Yes| G[401 TOKEN_EXPIRED]
    F -->|No| H["Set context.user = { sub, ghid, ghu, fam }"]
    H --> I["next()"]
```

The middleware sets the authenticated user on the request context. Downstream handlers and role-resolution middleware read from this context — they never parse tokens themselves.

### `optionalAuth` (lenient)

Used on public routes that optionally personalize content for logged-in users (e.g., leaderboard highlighting, "your team" badges).

```mermaid
flowchart LR
    A[Request] --> B{access_token cookie present?}
    B -->|No| C["next() — context.user = null"]
    B -->|Yes| D{JWT valid and not expired?}
    D -->|No| C
    D -->|Yes| E["Set context.user = { sub, ghid, ghu, fam }"]
    E --> F["next()"]
```

No error is returned for missing or invalid tokens — the request proceeds unauthenticated.

### `requireMFA` (conditional)

Used on sensitive operations where the organizer has mandated MFA for admin+ roles.

```mermaid
flowchart LR
    A[Request with valid access token] --> B{Route requires MFA?}
    B -->|No| C["next()"]
    B -->|Yes| D{User has MFA enabled?}
    D -->|No| E[403 MFA_REQUIRED — redirect to /settings/security]
    D -->|Yes| F{MFA verified within last 30 minutes?}
    F -->|Yes| C
    F -->|No| G[403 MFA_CHALLENGE_REQUIRED — redirect to /auth/mfa-challenge]
```

**Note:** MFA verification status is tracked server-side in the token family record (`mfa_verified_at` timestamp), not in the JWT. This prevents replay of a "pre-MFA" access token after the user completes MFA — the check hits D1 on every request that requires it.

---

## Frontend Auth Flow

### Initial Load

```mermaid
sequenceDiagram
    participant U as User
    participant SPA as React SPA
    participant AP as AuthProvider
    participant API as API Worker

    U->>SPA: Navigate to app
    SPA->>AP: Mount AuthProvider
    AP->>API: GET /auth/me (credentials: include)

    alt Access token valid
        API-->>AP: { ok: true, data: { user } }
        AP->>AP: Set state: authenticated
        AP->>SPA: Render dashboard
    else Access token expired, refresh token valid
        API-->>AP: 401 TOKEN_EXPIRED
        AP->>API: POST /auth/refresh (credentials: include)
        API-->>AP: New access token set via Set-Cookie
        AP->>API: Retry GET /auth/me
        API-->>AP: { ok: true, data: { user } }
        AP->>AP: Set state: authenticated
        AP->>SPA: Render dashboard
    else No valid tokens
        API-->>AP: 401
        AP->>AP: Set state: unauthenticated
        AP->>SPA: Render login page
    end
```

### AuthContext API

The frontend auth context exposes:

```typescript
interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `user` | `User \| null` | Current user: `id`, `github_username`, `display_name`, `avatar_url`, `has_mfa`, `github_linked` |
| `isAuthenticated` | `boolean` | `true` if user object is present |
| `isLoading` | `boolean` | `true` during initial `/auth/me` check and during token refresh |
| `logout()` | `() => Promise<void>` | Calls `POST /auth/logout`, clears context state, redirects to `/` |

### API Request Wrapper

All API calls from the frontend go through a wrapper function that:

1. Includes `credentials: 'include'` on every request (sends cookies)
2. On 401 `TOKEN_EXPIRED` response: automatically calls `POST /auth/refresh`, then retries the original request exactly once
3. On 401 with any other code (or if refresh fails): clears auth state and redirects to `/login`
4. Queues concurrent requests during refresh — only one refresh call fires at a time (mutex/promise deduplication)

---

## Logout

### Single-Device Logout

```mermaid
sequenceDiagram
    participant U as User Browser
    participant SPA as React SPA
    participant W as API Worker
    participant D1 as D1 Database

    U->>SPA: Click "Log out"
    SPA->>W: POST /auth/logout (credentials: include)

    W->>W: Extract family_id from access token
    W->>D1: UPDATE token_families<br/>SET revoked_at = now()<br/>WHERE family_id = {family_id}

    W->>U: Set-Cookie: access_token (maxAge=0, clear)<br/>Set-Cookie: refresh_token (maxAge=0, path=/auth/refresh, clear)<br/>200 OK

    SPA->>SPA: Clear AuthContext state
    SPA->>U: Redirect to /
```

### All-Device Logout

```mermaid
sequenceDiagram
    participant U as User Browser
    participant W as API Worker
    participant D1 as D1 Database

    U->>W: POST /auth/logout-all (credentials: include)

    W->>W: Extract user_id from access token
    W->>D1: UPDATE token_families<br/>SET revoked_at = now()<br/>WHERE user_id = {user_id}<br/>AND revoked_at IS NULL

    W->>U: Clear cookies, 200 OK
    Note over U: All other devices will get 401 SESSION_REVOKED on next request
```

---

## Passkey / WebAuthn

Passkeys provide phishing-resistant, passwordless authentication. Users register a platform authenticator (fingerprint, Face ID, hardware security key) from their settings page. Passkeys are additive — they do not replace OAuth. A user can log in via OAuth or passkey.

### Registration Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant SPA as Settings Page
    participant W as API Worker
    participant D1 as D1 Database

    U->>SPA: Click "Add passkey"
    SPA->>W: POST /auth/passkey/register/begin
    W->>W: Generate challenge (32 random bytes)
    W->>D1: Store challenge with 5-minute TTL
    W-->>SPA: PublicKeyCredentialCreationOptions<br/>(challenge, rp, user, pubKeyCredParams, attestation: none)

    SPA->>U: Browser prompts for biometric / security key
    U->>SPA: User completes gesture
    SPA->>W: POST /auth/passkey/register/complete<br/>(attestationResponse)

    W->>D1: Verify challenge exists and is not expired
    W->>W: Parse attestation, extract public key
    W->>D1: INSERT into user_credentials<br/>(credential_id, public_key, sign_count, transports, name)
    W-->>SPA: 201 Created
```

### Login Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant SPA as Login Page
    participant W as API Worker
    participant D1 as D1 Database

    U->>SPA: Click "Sign in with passkey"
    SPA->>W: POST /auth/passkey/login/begin
    W->>W: Generate challenge (32 random bytes)
    W->>D1: Store challenge with 5-minute TTL
    W-->>SPA: PublicKeyCredentialRequestOptions<br/>(challenge, rpId, allowCredentials: [])

    SPA->>U: Browser prompts for passkey selection
    U->>SPA: User completes gesture
    SPA->>W: POST /auth/passkey/login/complete<br/>(assertionResponse)

    W->>D1: Look up credential by credential_id
    W->>W: Verify signature against stored public key via crypto.subtle
    W->>W: Verify sign count > stored sign count (cloning detection)
    W->>D1: Update sign_count

    W->>W: Create token family, sign access + refresh tokens
    W->>U: Set-Cookie: access_token + refresh_token
```

### WebAuthn Configuration

| Property | Value | Rationale |
|----------|-------|-----------|
| Relying Party ID | `devsage.org` | Scoped to main domain |
| Relying Party Name | `DevSage` | Displayed in browser prompts |
| Attestation | `none` | Privacy-preserving — no attestation verification needed |
| User verification | `preferred` | Use biometric when available, fall back to PIN |
| Discoverable credentials | Yes | Enables passkey auto-fill in browsers |
| Algorithms | ES256 (-7), RS256 (-257) | Broad device support |
| Challenge TTL | 5 minutes | Generous for slow biometric prompts |
| Credential naming | User-provided label ("MacBook Pro", "YubiKey") | For session management UI |

---

## Multi-Factor Authentication (TOTP)

TOTP-based MFA is an optional security layer. Users enroll from a security settings page. Organizers can require MFA for admin-and-above roles on their hackathon.

### Enrollment Flow

```mermaid
sequenceDiagram
    participant U as User
    participant SPA as Settings Page
    participant W as API Worker
    participant D1 as D1 Database

    U->>SPA: Navigate to /settings/security, click "Enable MFA"
    SPA->>W: POST /auth/mfa/enroll/begin

    W->>W: Generate 20-byte random secret (base32-encoded)
    W->>W: Build otpauth URI:<br/>otpauth://totp/DevSage:{username}?secret={s}&issuer=DevSage&digits=6&period=30
    W->>D1: Store encrypted secret (AES-256-GCM) in user_mfa, status=pending
    W-->>SPA: { qr_uri, secret_plaintext, recovery_codes: string[10] }

    SPA->>U: Display QR code + manual entry key + recovery codes
    Note over U: User scans QR code with authenticator app

    U->>SPA: Enter 6-digit code from authenticator
    SPA->>W: POST /auth/mfa/enroll/verify { code }

    W->>D1: Decrypt secret, generate expected TOTP
    W->>W: Compare code with +-1 step tolerance

    alt Code valid
        W->>D1: UPDATE user_mfa SET status = active
        W->>D1: INSERT hashed recovery codes into recovery_codes table
        W-->>SPA: 200 MFA enabled
    else Code invalid
        W-->>SPA: 400 MFA_INVALID
    end
```

### Login with MFA

When a user with MFA enabled completes OAuth, they are not immediately issued access/refresh tokens. Instead, they receive a short-lived `mfa_pending` cookie and are redirected to a challenge page.

```mermaid
sequenceDiagram
    participant U as User Browser
    participant SPA as MFA Challenge Page
    participant W as API Worker
    participant D1 as D1 Database

    Note over U: User completed OAuth, has mfa_pending cookie

    SPA->>U: Display TOTP input field
    U->>SPA: Enter 6-digit code
    SPA->>W: POST /auth/mfa/verify<br/>Cookie: mfa_pending=...<br/>Body: { code }

    W->>W: Verify mfa_pending JWT (5-min expiry, contains user_id)
    W->>D1: Decrypt TOTP secret for user
    W->>W: Validate code (30-second window, +-1 step tolerance)

    alt Code valid
        W->>W: Create token family, sign access + refresh tokens
        W->>D1: SET mfa_verified_at = now() on token family
        W->>U: Clear mfa_pending cookie<br/>Set-Cookie: access_token + refresh_token<br/>200 OK
    else Code invalid
        W->>U: 401 MFA_INVALID (attempts remaining: N)
    else Too many attempts (5+)
        W->>U: 429 MFA_RATE_LIMITED (locked for 15 minutes)
    end
```

### Recovery Codes

10 single-use recovery codes are generated at MFA enrollment. Each is 8 characters, alphanumeric, stored as bcrypt hashes in the `recovery_codes` table. When a user submits a recovery code instead of a TOTP code:

1. Hash the submitted code, compare against all unused recovery codes for the user
2. If match found: mark that recovery code as `used_at = now()`, proceed as if TOTP succeeded
3. If no match: return `MFA_INVALID`
4. If fewer than 3 recovery codes remain: warn the user to generate new ones

### TOTP Configuration

| Property | Value |
|----------|-------|
| Algorithm | TOTP (RFC 6238) using HMAC-SHA1 via `crypto.subtle` |
| Period | 30 seconds |
| Digits | 6 |
| Window tolerance | +-1 step (accepts previous, current, and next code) |
| Secret length | 20 bytes (160 bits), base32-encoded for QR URI |
| Secret storage | AES-256-GCM encrypted in `user_mfa` table. Encryption key: `MFA_ENCRYPTION_KEY` env var |
| Recovery codes | 10 codes, 8 chars alphanumeric, bcrypt-hashed |
| Max attempts | 5 per challenge session, then 15-minute lockout |
| Enforcement | Optional per-user. Organizers can require MFA for `admin`+ roles via hackathon settings |

---

## Session Management

Every token family represents one login session on one device. The session management page lets users view and revoke sessions.

### GET /auth/sessions

Returns all active (non-revoked, non-expired) sessions for the authenticated user.

```typescript
interface Session {
  family_id: string;
  device: string;          // parsed from User-Agent: "Chrome on macOS", "Firefox on Windows", etc.
  location: string;        // country code from cf-ipcountry header captured at login: "US", "IN", etc.
  created_at: string;      // ISO-8601 — when the session was created (first login)
  last_active_at: string;  // ISO-8601 — most recent refresh token usage
  is_current: boolean;     // true if this is the requesting session's family
}
```

### DELETE /auth/sessions/:familyId

Revokes a specific session. Sets `revoked_at` on all tokens in that family. The affected device receives `401 SESSION_REVOKED` on its next request.

Cannot revoke the current session via this endpoint — use `POST /auth/logout` instead.

### Device and Location Capture

At login and each token refresh, the Worker captures:

- **User-Agent** → parsed into human-readable device string (e.g., "Safari on iPhone", "Chrome on Linux"). Parsing is best-effort — unknown agents show as "Unknown device".
- **`cf-ipcountry` header** → two-letter country code. Cloudflare provides this on every request. Stored on the token family record.

These are metadata for display only — not used for security decisions (IP-based blocking is handled by rate limiting, not session management).

---

## OAuth Scope Expansion

Initial login requests minimal GitHub scopes (`read:user`, `user:email`). When a team leader links a repository and needs bot capabilities, the app triggers incremental authorization for elevated scopes.

### Flow

```mermaid
sequenceDiagram
    participant U as Team Leader
    participant SPA as Repo Linking Page
    participant W as API Worker
    participant GH as GitHub OAuth

    U->>SPA: Click "Link Repository" for team
    SPA->>W: POST /api/v1/hackathons/:slug/teams/:id/repo<br/>{ repo_url }

    W->>W: Check if user has elevated GitHub token
    alt Has repo scope
        W->>W: Proceed with repo setup
    else Needs repo scope
        W-->>SPA: 403 GITHUB_SCOPE_REQUIRED<br/>{ redirect_url: /auth/github/elevate?scope=repo,admin:repo_hook }
    end

    SPA->>U: "DevSage needs additional GitHub permissions to manage your repo."
    U->>SPA: Click "Grant permissions"
    SPA->>W: GET /auth/github/elevate?scope=repo,admin:repo_hook&return_to=/teams/:id/settings

    W->>W: Generate state, store in KV with { scope, return_to }
    W->>U: 302 → github.com/login/oauth/authorize<br/>scope=repo admin:repo_hook read:user user:email

    U->>GH: Authorize additional scopes
    GH->>U: 302 → /auth/callback/github?code=...&state=...

    U->>W: GET /auth/callback/github
    W->>W: Detect scope elevation flow from state
    W->>GH: Exchange code for access_token
    W->>W: Encrypt access_token with AES-256-GCM
    W->>D1: Store encrypted token on user record (github_elevated_token)
    W->>U: 302 → {return_to}
```

| Scope | When Requested | Purpose |
|-------|---------------|---------|
| `read:user`, `user:email` | Initial login | Profile, identity |
| `repo` | Repo linking (incremental) | Bot: read commits, comment on PRs, create commit statuses |
| `admin:repo_hook` | Repo linking (incremental) | Manage webhooks programmatically (create/delete) |

The elevated token is:
- Encrypted at rest (AES-256-GCM, key: `GITHUB_TOKEN_ENCRYPTION_KEY` env var)
- Used exclusively by the queue consumer for bot operations (never sent to the frontend)
- Scoped to the team's linked repo only by convention (the token technically has broader access, but the bot code only operates on the linked repo)

---

## Rate Limiting

All `/auth/*` endpoints are rate-limited at the Cloudflare edge to prevent credential stuffing, OAuth abuse, and brute-force attacks. Rate limits are enforced before the Worker executes, using the client IP as the key.

| Endpoint Pattern | Limit | Window | Block Duration | Notes |
|-----------------|-------|--------|----------------|-------|
| `GET /auth/github` | 10 | 1 minute | 5 minutes | OAuth initiation |
| `GET /auth/google` | 10 | 1 minute | 5 minutes | OAuth initiation |
| `GET /auth/callback/*` | 20 | 1 minute | 10 minutes | OAuth callbacks |
| `POST /auth/refresh` | 30 | 1 minute | 5 minutes | Token refresh |
| `POST /auth/logout` | 10 | 1 minute | 1 minute | Logout |
| `POST /auth/mfa/*` | 10 | 1 minute | 15 minutes | MFA verification — stricter to prevent brute force |
| `POST /auth/passkey/*` | 10 | 1 minute | 10 minutes | WebAuthn ceremonies |
| `DELETE /auth/account` | 3 | 1 hour | 1 hour | Account deletion requests |

**Implementation:** Configured via Cloudflare Rate Limiting Rules (dashboard or Terraform). Not enforced in Worker code — edge enforcement means blocked requests never consume Worker CPU.

---

## Account Deletion & GDPR

### Data Export

`GET /auth/account/export` — generates a JSON archive of all user-associated data and returns a signed download URL.

**What's included:**
- User profile (id, usernames, email, display name, avatar, created_at)
- All team memberships across hackathons (team name, role, joined_at)
- All submissions associated with user's teams
- All scores received (as judge or participant)
- All audit events where user is the actor (anonymized event targets)
- OAuth provider metadata (which providers linked, when)

**What's excluded:**
- Other users' data (even within same team)
- Hackathon configuration data (owned by organizer)
- Audit events where user is the target but not the actor

**Delivery:** The Worker generates the JSON, uploads to R2, creates a signed URL with 24-hour expiry, and returns it. For large exports, the generation is enqueued and the user receives an email with the download link when ready.

### Account Deletion

Two-phase deletion to prevent accidental or malicious account removal.

```mermaid
sequenceDiagram
    participant U as User
    participant W as API Worker
    participant D1 as D1 Database
    participant Q as NOTIFICATION_QUEUE
    participant R2 as R2 Storage

    U->>W: DELETE /auth/account
    W->>W: Generate deletion confirmation token (UUID, 24-hour expiry)
    W->>D1: INSERT into deletion_requests (user_id, token_hash, expires_at)
    W->>Q: Enqueue confirmation email with token link
    W-->>U: 202 Accepted — "Check your email"

    Note over U: User receives email with confirmation link

    U->>W: POST /auth/account/delete-confirm<br/>{ token }
    W->>D1: Validate token exists, not expired, not used
    W->>D1: Mark deletion request as confirmed

    W->>Q: Enqueue ACCOUNT_DELETION job

    Note over Q: Queue consumer processes deletion

    Q->>D1: Revoke all token families for user
    Q->>D1: Remove from all teams (reassign leader if needed)
    Q->>D1: Delete scores submitted by user
    Q->>D1: Delete user_credentials (passkeys)
    Q->>D1: Delete user_mfa + recovery_codes
    Q->>D1: Anonymize audit events (set actor to "deleted_user_{hash}")
    Q->>D1: Delete OAuth tokens (github_elevated_token)
    Q->>D1: Delete user record
    Q->>R2: Delete any user-uploaded assets

    Q-->>U: Confirmation email — "Your account has been deleted"
```

| Phase | Endpoint | Timeline |
|-------|----------|----------|
| Request | `DELETE /auth/account` | Immediate |
| Confirmation email | Sent via notification queue | Within minutes |
| Confirm | `POST /auth/account/delete-confirm` | Token valid for 24 hours |
| Execution | Queue job cascades all deletions | Within 1 hour of confirmation |
| Completion email | Sent after deletion completes | Confirmation of removal |

**Team leader reassignment:** If the deleted user is a team leader, the system auto-promotes the longest-tenured team member to leader. If the user is the only team member, the team is archived (not deleted — the hackathon organizer may need the submission record).

**Audit event anonymization:** Audit events are NOT deleted. They are anonymized: the actor field is replaced with `deleted_user_{first_8_chars_of_user_id}` and all PII fields (email, username) in the event metadata are scrubbed. This preserves the audit trail for organizer accountability without retaining personal data.

---

## Error Code Catalog

Every error response from auth endpoints uses a machine-readable `code` field in the standard error envelope: `{ ok: false, error: { code, message } }`.

| Code | HTTP Status | When | User-Facing Message |
|------|-------------|------|---------------------|
| `NO_TOKEN` | 401 | No `access_token` cookie present | "Authentication required. Please sign in." |
| `INVALID_TOKEN` | 401 | JWT signature verification fails | "Invalid session. Please sign in again." |
| `TOKEN_EXPIRED` | 401 | Access token `exp` < current time | "Session expired." (frontend auto-refreshes) |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token not found in DB | "Session not found. Please sign in again." |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token past 30-day expiry | "Session expired. Please sign in again." |
| `REFRESH_TOKEN_REUSED` | 401 | Refresh token already consumed (replay) | "Security alert: session was compromised. All sessions revoked. Please sign in again." |
| `SESSION_REVOKED` | 401 | Token family explicitly revoked | "This session has been revoked." |
| `INVALID_STATE` | 401 | OAuth state parameter missing/expired/mismatched | "Login expired. Please try again." |
| `OAUTH_FAILED` | 401 | Code exchange with provider failed | "Authentication with {provider} failed. Please try again." |
| `GITHUB_LINK_REQUIRED` | 403 | User has no github_id, trying to access GitHub-dependent feature | "Please link your GitHub account to use this feature." |
| `GITHUB_SCOPE_REQUIRED` | 403 | Bot action needs elevated GitHub token | "Additional GitHub permissions required." |
| `ACCOUNT_MERGE_CONFLICT` | 409 | Account linking would create conflicting team memberships | "Cannot link accounts — conflicting team memberships exist." |
| `MFA_REQUIRED` | 403 | Route requires MFA but user has not enrolled | "Multi-factor authentication required for this action." |
| `MFA_CHALLENGE_REQUIRED` | 403 | User has MFA but hasn't verified in this session recently | "Please verify your identity with your authenticator app." |
| `MFA_INVALID` | 401 | TOTP code or recovery code is incorrect | "Invalid verification code. Please try again." |
| `MFA_RATE_LIMITED` | 429 | Too many failed MFA attempts | "Too many failed attempts. Try again in 15 minutes." |
| `RATE_LIMITED` | 429 | Cloudflare edge rate limit triggered | "Too many requests. Please wait and try again." |
| `ACCOUNT_DELETED` | 410 | User attempts to log in after account deletion | "This account has been deleted." |
| `ACCOUNT_NOT_FOUND` | 404 | User ID in token doesn't match any DB record | "Account not found." |
| `PASSKEY_REGISTRATION_FAILED` | 400 | WebAuthn attestation verification failed | "Passkey registration failed. Please try again." |
| `PASSKEY_VERIFICATION_FAILED` | 401 | WebAuthn assertion verification failed | "Passkey verification failed. Please try again." |
| `DELETION_TOKEN_INVALID` | 400 | Account deletion confirmation token expired or invalid | "Deletion link expired. Please request again." |

---

## Security Threat Model

| Threat | Mitigation |
|--------|-----------|
| XSS token theft | HttpOnly cookies — JavaScript cannot read tokens. Even if XSS is present, tokens are not extractable. |
| CSRF | `SameSite=Strict` in production. `Origin` header validation on all mutation endpoints. Refresh token scoped to `/auth/refresh` path only. |
| Token replay (access) | 15-minute expiry limits window. No server-side revocation check on access tokens (stateless by design). |
| Token replay (refresh) | Single-use with family-based replay detection. Reuse of a consumed refresh token revokes the entire family, killing all sessions from that login. |
| OAuth state forgery | Cryptographically random state stored in KV with 10-minute TTL. State is consumed (deleted) on first use — cannot be replayed. |
| Brute-force MFA | 5-attempt limit per challenge, then 15-minute lockout. Edge rate limiting on `/auth/mfa/*`. |
| Passkey cloning | Sign count verification — if a credential's sign count is not strictly increasing, the credential may have been cloned. Reject and warn user. |
| Account takeover via email | Email is not used for authentication. OAuth provider identity (GitHub ID / Google ID) is the key. Changing email on the provider doesn't affect DevSage auth. |
| Stolen refresh token | Refresh tokens are hashed (SHA-256) in the database. Even if D1 is compromised, raw tokens cannot be extracted. Combined with single-use rotation, a stolen token from network interception is detectable on reuse. |
| Privilege escalation | Roles are resolved per-request from D1, never from the token. Even if an attacker modifies the JWT payload, they cannot escalate roles — `sub` is validated and roles are fetched from the source of truth. |
| Timing attacks on JWT verify | `crypto.subtle.verify()` uses constant-time comparison internally. No custom comparison code. |
| GitHub app deauthorization | DevSage does not store long-lived GitHub access tokens from login (only used transiently during callback). If a user revokes the GitHub App, existing DevSage sessions remain valid until expiry. Bot features stop working when the elevated token is revoked. |

---

## Edge Cases

### Concurrent OAuth from Multiple Tabs

Two tabs start OAuth simultaneously. Each generates a different `state` value stored in KV. Both can complete independently — the second callback's `Set-Cookie` overwrites the first tab's cookies. This is harmless because the user upsert is idempotent (same `github_id` → same user record) and both token families are valid. The first tab's tokens are simply replaced.

### Expired KV State (Slow OAuth)

If a user takes longer than 10 minutes on the provider's consent screen, the state token expires in KV. When the callback arrives, KV returns `null` → `401 INVALID_STATE`. The user must restart the OAuth flow. The 10-minute window is generous — typical OAuth consent takes under 30 seconds.

### JWT Clock Skew

All JWT verification happens on Cloudflare Workers, which use globally synchronized clocks across all edge locations. There is no cross-server clock skew. Client clocks are irrelevant — `exp` is checked server-side only. No clock-skew tolerance is needed or implemented.

### GitHub App Revocation

DevSage does not store the GitHub OAuth access token from login beyond the callback handler. If a user revokes DevSage's GitHub App from their GitHub settings, there is no immediate effect on their DevSage session — the access/refresh tokens remain valid. However:
- Bot features (PR comments, commit status) stop working if the elevated token is also revoked
- The user's next login attempt with GitHub will require re-authorization

### Cookie Domain Mismatch (Local Development)

Production cookies use `domain: .devsage.org`. In local development, the `domain` field is omitted entirely, which causes the cookie to default to the exact host (`localhost`). This prevents cookies from being rejected due to domain mismatch.

### Refresh Token Race Condition

Multiple tabs may detect an expired access token simultaneously and all attempt `POST /auth/refresh` with the same refresh token. The first request succeeds and marks the token as `used_at = now()`. Subsequent requests see the token as already used — this looks like replay. To handle this gracefully:
- The refresh endpoint uses a short grace period (5 seconds) after `used_at` is set. If the same token hash is presented within 5 seconds of being consumed, the request receives the same new token pair (idempotent refresh).
- After the grace period, it triggers full family revocation (true replay detection).

### Account with Only Google (No GitHub)

A user who signs in with Google and never links GitHub has limited functionality:
- Can browse public hackathon pages
- Can view leaderboards
- Cannot join teams, submit, or participate in judging
- Sees a persistent banner: "Link your GitHub account to participate"
- Their `ghid` field in the access token is `0` and `ghu` is `""`

---

## Database Tables

All tables use `TEXT` primary keys (UUIDs generated via `crypto.randomUUID()`). Timestamps are ISO-8601 UTC strings. All tables should be defined with Drizzle ORM for D1/SQLite.

### `users` (modified from v2)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `github_id` | INTEGER UNIQUE | Nullable — not set for Google-only users |
| `google_id` | TEXT UNIQUE | Nullable — not set for GitHub-only users |
| `github_username` | TEXT | Nullable |
| `email` | TEXT | From OAuth provider |
| `display_name` | TEXT | From OAuth provider, editable |
| `avatar_url` | TEXT | From OAuth provider |
| `github_elevated_token` | TEXT | AES-256-GCM encrypted. Nullable. Only set after scope elevation |
| `has_mfa` | INTEGER | 0 or 1. Denormalized for fast middleware checks |
| `last_login_at` | TEXT | ISO-8601 |
| `created_at` | TEXT | ISO-8601 |
| `updated_at` | TEXT | ISO-8601 |

### `token_families` (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID — this is the `family_id` |
| `user_id` | TEXT FK → users.id | Owner |
| `token_hash` | TEXT | SHA-256 hash of the current (latest) refresh token |
| `device` | TEXT | Parsed User-Agent string |
| `location` | TEXT | Country code from `cf-ipcountry` |
| `mfa_verified_at` | TEXT | ISO-8601. Nullable. When MFA was last verified in this session |
| `expires_at` | TEXT | ISO-8601. 30 days from most recent refresh |
| `used_at` | TEXT | ISO-8601. Set when this specific token is consumed during refresh |
| `revoked_at` | TEXT | ISO-8601. Set on logout, session revocation, or replay detection |
| `created_at` | TEXT | ISO-8601. When the session was first created |

**Indexes:** `user_id` (for session listing), `token_hash` (for refresh lookup).

### `user_credentials` (new — passkeys)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `user_id` | TEXT FK → users.id | Owner |
| `credential_id` | BLOB | WebAuthn credential ID (binary) |
| `public_key` | BLOB | COSE public key (binary) |
| `sign_count` | INTEGER | Incremented on each use — cloning detection |
| `transports` | TEXT | JSON array: `["internal", "usb", "ble", "nfc"]` |
| `name` | TEXT | User-provided label: "MacBook Pro", "YubiKey 5" |
| `created_at` | TEXT | ISO-8601 |
| `last_used_at` | TEXT | ISO-8601 |

**Indexes:** `user_id`, `credential_id` (unique).

### `user_mfa` (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `user_id` | TEXT FK → users.id | Unique — one MFA config per user |
| `encrypted_secret` | TEXT | AES-256-GCM encrypted TOTP secret |
| `encryption_iv` | TEXT | Initialization vector for AES-GCM (base64) |
| `status` | TEXT | `pending` (during enrollment) or `active` |
| `created_at` | TEXT | ISO-8601 |

**Indexes:** `user_id` (unique).

### `recovery_codes` (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `user_id` | TEXT FK → users.id | Owner |
| `code_hash` | TEXT | bcrypt hash of the recovery code |
| `used_at` | TEXT | ISO-8601. Nullable. Set when consumed |
| `created_at` | TEXT | ISO-8601 |

**Indexes:** `user_id`.

### `deletion_requests` (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `user_id` | TEXT FK → users.id | Who requested deletion |
| `token_hash` | TEXT | SHA-256 hash of confirmation token |
| `expires_at` | TEXT | ISO-8601. 24 hours from request |
| `confirmed_at` | TEXT | ISO-8601. Nullable. Set when user confirms |
| `completed_at` | TEXT | ISO-8601. Nullable. Set when deletion job finishes |
| `created_at` | TEXT | ISO-8601 |

**Indexes:** `user_id`, `token_hash`.

### `webauthn_challenges` (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `user_id` | TEXT | Nullable — null for login challenges (discoverable credential) |
| `challenge` | TEXT | Base64-encoded 32-byte challenge |
| `type` | TEXT | `registration` or `authentication` |
| `expires_at` | TEXT | ISO-8601. 5 minutes from creation |
| `created_at` | TEXT | ISO-8601 |

**Indexes:** `challenge` (unique), `expires_at` (for cleanup).

---

## Migration from v2

The transition from v2 (single long-lived JWT) to v3 (dual-token with refresh rotation) must not log out existing users.

### Phase 1: Deploy Dual-Token Infrastructure

- Deploy all new tables (`token_families`, `user_credentials`, `user_mfa`, etc.)
- Deploy the new auth middleware that accepts BOTH formats:
  - Old format: single `session` cookie containing a 7-day JWT → treat as valid access token, no refresh capability
  - New format: `access_token` + `refresh_token` cookies → full v3 flow
- Deploy the `/auth/refresh` endpoint (no-ops for legacy sessions)
- Deploy updated frontend with refresh interceptor logic

**Duration:** 1 deploy. No user impact. Old sessions continue working.

### Phase 2: Issue New Tokens on Login

- All new logins (OAuth callbacks) issue v3 dual tokens instead of the legacy single JWT
- Existing sessions with the old `session` cookie continue working until natural expiry (up to 7 days)
- The old `session` cookie is accepted but never refreshed — when it expires, the user re-authenticates and gets v3 tokens

**Duration:** 7 days (one full JWT expiry cycle).

### Phase 3: Remove Legacy Acceptance

- Remove the code path that accepts the old `session` cookie format
- Clean up: delete any remaining `session` cookies by setting `maxAge=0` on any request that presents one
- All users are now on v3 dual-token auth

**Duration:** 1 deploy. Any user who hasn't logged in for 7+ days simply re-authenticates.

### Passkeys and MFA

These are purely additive. No migration needed — users opt in from settings. Organizer-mandated MFA for admin+ roles only takes effect after the organizer enables it in hackathon settings; it doesn't retroactively lock out existing admins (they get a grace period prompt to set up MFA).

---

## Feature Dependency Graph

```mermaid
graph TD
    A[Refresh Token Rotation] --> B[Session Management Dashboard]
    A --> C[Account Deletion / GDPR]
    
    D[Rate Limiting] -.->|independent| A
    E[Passkey / WebAuthn] -.->|independent| A
    F[MFA / TOTP] -.->|independent| A
    G[OAuth Scope Expansion] -.->|independent| A

    B --> H["All-Device Logout (uses session list)"]
    
    style A fill:#ef4444,color:#fff
    style D fill:#f59e0b,color:#fff
    style E fill:#3b82f6,color:#fff
    style F fill:#3b82f6,color:#fff
    style G fill:#6b7280,color:#fff
    style B fill:#10b981,color:#fff
    style C fill:#10b981,color:#fff
    style H fill:#10b981,color:#fff
```

| Feature | Priority | Complexity | Depends On | New Tables |
|---------|----------|------------|------------|------------|
| Refresh token rotation | **High** | Medium | Nothing (first) | `token_families` |
| Rate limiting | **High** | Low | Nothing (Cloudflare config) | None |
| Session management | Medium | Medium | Refresh token rotation | None (uses `token_families`) |
| Passkey / WebAuthn | Medium | High | Nothing | `user_credentials`, `webauthn_challenges` |
| MFA (TOTP) | Medium | Medium | Nothing | `user_mfa`, `recovery_codes` |
| OAuth scope expansion | Medium | Low | Nothing | Column on `users` |
| Account deletion / GDPR | Medium | High | Refresh token rotation | `deletion_requests` |

**Recommended implementation order:**
1. Refresh token rotation + rate limiting (parallel — no overlap)
2. MFA + passkeys (parallel — independent features)
3. Session management (needs token families from step 1)
4. OAuth scope expansion (independent, low effort)
5. Account deletion / GDPR (needs token families, high effort, do last)

---

## Decision Log

Key architectural decisions and their rationale.

| Decision | Choice | Why | Alternatives Considered |
|----------|--------|-----|------------------------|
| No external JWT library | `crypto.subtle` only | Workers have Web Crypto built in. External libs add bundle size and may use Node.js APIs unavailable in Workers runtime. | `jose`, `jsonwebtoken` — both have Workers compatibility issues |
| HMAC-SHA256 for JWTs | Symmetric signing | Single service verifies tokens (no cross-service verification needed). Symmetric is simpler and faster than RSA/ECDSA. | RS256, ES256 — unnecessary complexity for single-issuer/single-verifier |
| 15-minute access token expiry | Short-lived stateless | Limits blast radius of stolen tokens. Long enough that typical user sessions rarely hit refresh. | 5 min (too aggressive, constant refreshing), 1 hour (too long exposure), 7 days (v2 — no revocability) |
| 30-day refresh token expiry | Long session continuity | Matches user expectation of staying logged in. Monthly re-auth is acceptable UX. | 7 days (too frequent re-auth), 90 days (too long, increases risk) |
| Opaque refresh tokens (not JWTs) | Must be revocable server-side | Session management requires server-side revocation. JWTs are stateless by design — adding a revocation list defeats the purpose. | JWT refresh tokens with revocation list — more complex, same result |
| `SameSite=Strict` in prod | Maximum CSRF protection | Both frontend and API share `.devsage.org` domain. OAuth redirects from GitHub/Google back to our callback are same-site. No cross-site cookie sending needed. | `Lax` — weaker CSRF protection, not needed since our setup allows `Strict` |
| `SameSite=Lax` in dev | OAuth redirect compatibility | GitHub/Google redirect to `localhost`, which is cross-site. `Strict` blocks cookies on cross-site navigation. `Lax` allows cookies on top-level navigations (GET redirects). | `None` + `Secure` — requires HTTPS in dev, unnecessary |
| GitHub ID as primary identity | Required for bot features | DevSage's core features (commit tracking, PR comments, tag-based submissions) all require GitHub integration. Google is a convenience login. | Email as primary key — unreliable (users change emails), doesn't map to GitHub API |
| Roles NOT in JWT | Per-request resolution | A user's role varies by hackathon and can change mid-session (promoted to admin, invited as judge). Baking into JWT would require re-issuance on every role change. | Role in JWT with short expiry — still has staleness window, more complex |
| TOTP AND WebAuthn (not just one) | Maximum device coverage | WebAuthn requires platform support (not all devices/browsers). TOTP works on any phone with an authenticator app. Offering both maximizes coverage for security-conscious users. | WebAuthn only — excludes users without compatible devices. TOTP only — misses phishing resistance of WebAuthn |
| No `@hono/oauth-providers` | Broken on Workers | The library has known issues with Cloudflare Workers runtime (missing Node.js APIs, incorrect fetch behavior). Manual OAuth is ~50 lines of code per provider. | Fix upstream — out of our control, manual impl is trivial |
| No password auth | Reduced attack surface | No password database = no credential stuffing, no password reset flow, no bcrypt at scale. OAuth providers handle credential management. | Email + password as fallback — massive increase in security surface area |
| 5-second refresh grace period | Handles concurrent tabs | Multiple tabs detecting expiry simultaneously is common. Without grace, the second tab triggers false replay detection and revokes the family. | Mutex in frontend only — doesn't handle multiple browser windows. Longer grace — increases replay detection window |
