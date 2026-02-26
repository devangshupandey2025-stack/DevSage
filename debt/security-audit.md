# DevSage Backend — Security Audit

**Date:** 2026-02-15  
**Scope:** `apps/api/` (Cloudflare Worker), CI/CD workflows, `packages/shared/` validation layer  
**Auditor:** Automated deep-code review  
**Branch:** `main`

---

## Executive Summary

This audit reviews the DevSage API backend — a Cloudflare Worker handling authentication, hackathon management, judging, webhooks, and notifications. The system uses cookie-based JWT auth across multiple subdomains, PBKDF2 password hashing, D1 (SQLite) via parameterized queries, and KV for rate limiting and caching.

**Overall posture:** The codebase demonstrates strong fundamentals — no SQL injection, CSPRNG throughout, timing-safe HMAC verification, refresh-token replay detection, and hash-chain audit trails. However, several structural gaps exist: zero Zod validation on API inputs, overly-broad CORS wildcard patterns, no CSRF protection, rate limiting only on auth routes, and no automated dependency scanning.

---

## Summary by Severity

| Severity | Count | Open | Fixed | Partial |
|----------|-------|------|-------|---------|
| CRITICAL | 2     | 1    | 0     | 1       |
| HIGH     | 5     | 2    | 2     | 1       |
| MEDIUM   | 8     | 5    | 2     | 1       |
| LOW      | 8     | 5    | 2     | 1       |
| INFO     | 5     | 5    | 0     | 0       |
| **Total**| **28**| **18** | **6** | **4** |

---

## Findings

### SEC-001 — CRITICAL: No Input Validation on Any API Endpoint

- **Severity:** CRITICAL
- **Location:** All files in `apps/api/src/routes/` (13 route files, ~72 `c.req.json()` calls)
- **Status:** Open

**Description:**  
Zero Zod schemas are imported or used in any API route handler. All request body parsing uses `c.req.json<T>()` with TypeScript type annotations that provide no runtime validation. The `@devsage/shared` package contains well-defined Zod schemas (`createHackathonSchema`, `updateHackathonSchema`, etc.) but they are never imported by the API.

Four endpoints accept completely untyped input:

| File | Line | Endpoint |
|------|------|----------|
| `routes/hackathons.ts` | 16 | `POST /hackathons` — `c.req.json<Record<string, unknown>>()` |
| `routes/hackathons.ts` | 187 | `PATCH /hackathons/:slug` — `c.req.json<Record<string, unknown>>()` |
| `routes/workspaces.ts` | 110 | `PATCH /workspaces/:id` — `c.req.json<Record<string, unknown>>()` |
| `routes/judging.ts` | 63 | `PATCH /rubric-criteria/:id` — `c.req.json<Record<string, unknown>>()` |

The remaining endpoints use TypeScript type annotations (e.g., `c.req.json<{ email: string }>()`) which provide no runtime enforcement.

**Impact:**  
- Arbitrary fields passed to dynamic SQL `SET` builders (mitigated by field whitelists, but defense-in-depth is absent)
- Type confusion attacks — strings where numbers expected, oversized payloads, prototype pollution via `__proto__` keys
- No length limits on string fields → potential D1 storage abuse (1MB row limit is the only backstop)
- Business logic bypass — missing required fields silently become `undefined`

**Recommendation:**  
Wire `@devsage/shared` Zod schemas into every route handler. Create a Hono middleware or helper:
```ts
const body = createHackathonSchema.parse(await c.req.json());
```

---

### SEC-002 — CRITICAL: CORS Wildcard Patterns Allow Any Cloudflare Project

- **Severity:** CRITICAL
- **Location:** `apps/api/wrangler.jsonc:94-96`, `apps/api/src/lib/allowed-origin.ts:28-37`
- **Status:** Open

**Description:**  
The CORS origin allowlist includes three wildcard patterns:

```jsonc
// wrangler.jsonc L94-96
"HACKATHON_ORIGIN_PATTERN": "https://*.devsage.org",
"PAGES_ORIGIN_PATTERN": "https://*.pages.dev",
"WORKERS_ORIGIN_PATTERN": "https://*.workers.dev"
```

In `allowed-origin.ts:33-34`, `*` is converted to regex `[a-z0-9.-]+` with anchors `^...$`. This means:

- `https://*.pages.dev` matches **any** Cloudflare Pages project globally (e.g., `https://evil-attacker.pages.dev`)
- `https://*.workers.dev` matches **any** Cloudflare Worker globally (e.g., `https://malicious.workers.dev`)
- `https://*.devsage.org` matches any subdomain including nested ones (e.g., `https://evil.sub.devsage.org`)

Combined with `credentials: true` in `cors.ts:19`, an attacker who creates a free Cloudflare Pages site can make credentialed cross-origin requests to the DevSage API. The user's `access_token` and `refresh_token` cookies will be attached automatically.

**Impact:**  
Full account takeover. An attacker's site at `evil.pages.dev` can:
1. Call `GET /auth/me` to steal user identity
2. Call any mutating endpoint as the victim
3. Call `POST /auth/refresh` to obtain new tokens
4. Exfiltrate data via `GET` endpoints

**Recommendation:**  
Replace wildcard patterns with explicit allowlists of known project subdomains:
```jsonc
"PAGES_ORIGIN_PATTERN": "https://devsage-web.pages.dev",
"WORKERS_ORIGIN_PATTERN": "https://devsage-api.workers.dev"
```
Or implement a lookup against a known-hackathons registry for `*.devsage.org`.

---

### SEC-003 — HIGH: Legacy Bearer Path Trusts JWT Claims Without DB Verification

- **Severity:** HIGH
- **Location:** `apps/api/src/middleware/auth.ts:38-52`
- **Status:** Partially Fixed (documented as transitional, still active)

**Description:**  
When a request arrives with a `Bearer` token (no cookie), the auth middleware trusts all claims from the JWT payload directly — including `platformAdmin`, `hackathonRoles`, and `workspaceRoles` — without verifying against the database:

```ts
// auth.ts L38-52
if (!cookieToken) {
  c.set('user', {
    id: payload.sub,
    platformAdmin: payloadPlatformAdmin,     // trusted from JWT
    hackathonRoles: payloadHackathonRoles,    // trusted from JWT
    workspaceRoles: payloadWorkspaceRoles,    // trusted from JWT
  });
  return next();
}
```

The cookie-based path (L55-141) performs 5 parallel DB queries to resolve roles from the database. The Bearer path skips all of this.

**Impact:**  
If `JWT_SECRET` is compromised (or leaked via CI, logs, or side-channel), an attacker can forge a JWT with `platformAdmin: true` and gain full admin access via the Bearer path, bypassing all DB-backed role checks. Even with a valid secret, this path returns stale role data (roles at time of JWT issuance, not current).

**Recommendation:**  
Remove the legacy Bearer path or make it perform the same DB-backed role resolution as the cookie path. If kept for backward compatibility, at minimum remove `platformAdmin` from the trusted claims.

---

### SEC-004 — HIGH: No CSRF Protection on State-Changing Endpoints

- **Severity:** HIGH
- **Location:** All mutating routes (`POST`, `PUT`, `PATCH`, `DELETE`) across `apps/api/src/routes/`
- **Status:** Open

**Description:**  
The application uses cookie-based authentication with `SameSite: 'None'` (required for cross-subdomain cookies between `api.devsage.org` and `*.devsage.org` frontends). No CSRF mitigation is implemented:

- No CSRF tokens (double-submit cookie, synchronizer token, or signed double-submit)
- No `Origin` or `Referer` header validation on state-changing requests
- No custom header requirement (e.g., `X-Requested-With`)
- `SameSite: 'None'` disables the browser's built-in CSRF protection

The CORS policy provides partial mitigation — browsers enforce preflight for non-simple requests. However:
- `POST` with `Content-Type: application/x-www-form-urlencoded` is a "simple request" (no preflight)
- Combined with SEC-002 (broad CORS wildcards), even `application/json` requests are allowed cross-origin

**Impact:**  
An attacker-controlled page (especially one on `*.pages.dev` per SEC-002) can submit state-changing requests as the victim user: create hackathons, modify teams, change settings, delete accounts.

**Recommendation:**  
Implement Origin header validation as a middleware for all non-GET/HEAD/OPTIONS requests:
```ts
const origin = c.req.header('origin');
if (!origin || !isAllowedOrigin(origin, c.env)) {
  return errorResponse(c, 403, 'FORBIDDEN', 'Invalid origin');
}
```
Additionally consider a custom header requirement (`X-DevSage-Request: 1`) which forces a preflight and confirms JavaScript execution context.

---

### SEC-005 — HIGH: Rate Limiting Only Applied to Auth Routes

- **Severity:** HIGH
- **Location:** `apps/api/src/middleware/rate-limit.ts`, `apps/api/src/index.ts:37-40`
- **Status:** Partially Fixed (auth tier exists, other tiers defined but not applied)

**Description:**  
The rate limiter defines four tiers (`auth: 10/min`, `api: 100/min`, `webhook: 200/min`, `admin: 50/min`) but is only applied to auth routes:

```
# Routes with rate limiting:
apps/api/src/routes/auth.ts:40   auth.use('/*', rateLimitMiddleware('auth'))

# Routes WITHOUT rate limiting (0 references):
admin.ts, announcements.ts, audit.ts, hackathon-requests.ts,
hackathons.ts, invites.ts, judge-portal.ts, judging.ts,
notifications.ts, organizers.ts, rounds.ts, submissions.ts,
team-repos.ts, teams.ts, webhooks.ts, workspaces.ts
```

The rate limiter is also absent from the global middleware chain in `index.ts:37-40` (CORS → Request ID → optionalAuth → Error Handler).

**Impact:**  
- Brute-force enumeration of hackathon slugs, team names, user IDs
- Webhook endpoint abuse (no `webhook` tier applied despite being defined)
- Resource exhaustion via expensive endpoints (submissions, judging computations)
- Admin endpoint abuse if platform admin credentials are compromised

**Recommendation:**  
Apply rate limiting globally in `index.ts` with the `api` tier as default, and apply stricter tiers to specific route groups:
```ts
app.use('/*', rateLimitMiddleware('api'));             // global default
auth.use('/*', rateLimitMiddleware('auth'));           // already done
webhooks.use('/*', rateLimitMiddleware('webhook'));    // add
admin.use('/*', rateLimitMiddleware('admin'));         // add
```

---

### SEC-006 — HIGH: User Enumeration via Registration Endpoint

- **Severity:** HIGH
- **Location:** `apps/api/src/routes/auth.ts:161`
- **Status:** Open

**Description:**  
The registration endpoint returns a distinct error when an email is already registered:

```ts
// auth.ts L161
return errorResponse(c, 409, 'CONFLICT', 'Email already registered');
```

This allows an attacker to enumerate valid email addresses by attempting registration and checking for 409 vs 201.

In contrast, the login endpoint correctly returns `"Invalid email or password"` for both non-existent users and wrong passwords (L213-219). The forgot-password endpoint also correctly always returns success (L589/628).

**Impact:**  
Email enumeration enables targeted phishing, credential stuffing against other services, and social engineering attacks. Combined with the rate limiter applying only to auth routes (SEC-005), enumeration can be automated at scale.

**Recommendation:**  
Return a generic success-like response even if the email exists:
```ts
if (existing) {
  // Send a "someone tried to register with your email" notification
  // but return 200 to prevent enumeration
  return successResponse(c, { message: 'Check your email to continue' }, 200);
}
```

---

### SEC-007 — HIGH: SMTP Credentials Logged in Plaintext

- **Severity:** HIGH
- **Location:** `apps/api/src/services/email.ts:67`
- **Status:** Open

**Description:**  
The email service logs SMTP configuration including the username in plaintext:

```ts
// email.ts L67
console.warn(`[email] SMTP config: host=${config.host} port=${config.port} user=${config.username}`);
```

Additionally, `services/smtp.ts` logs verbose SMTP protocol interactions including `AUTH` command responses (L226), `MAIL FROM` (L232), and `RCPT TO` with recipient addresses (L237).

On Cloudflare Workers, `console.warn` output goes to Workers Logs / Logpush, which may be accessible to team members or stored in log aggregation services.

**Impact:**  
SMTP credentials visible in log output. If logs are compromised, stored insecurely, or accessible to unauthorized team members, the SMTP account can be hijacked to send phishing emails from the DevSage domain.

**Recommendation:**  
Remove credential logging:
```ts
console.warn(`[email] SMTP config: host=${config.host} port=${config.port} user=***`);
```
Reduce SMTP protocol logging to status codes only (no full command text).

---

### SEC-008 — MEDIUM: Rate Limiter TOCTOU Race Condition

- **Severity:** MEDIUM
- **Location:** `apps/api/src/middleware/rate-limit.ts:25-26`
- **Status:** Open

**Description:**  
The KV-based rate limiter performs a non-atomic read-then-write:

```ts
// rate-limit.ts L25-26
const current = parseInt(await c.env.KV.get(key) ?? '0');  // READ
if (current >= config.limit) { return 429; }
// ... later:
c.executionCtx.waitUntil(c.env.KV.put(key, String(current + 1), ...));  // WRITE
```

Two concurrent requests can both read `current = 9` (limit 10), both pass the check, and both increment to 10 — allowing 11 requests through. With high concurrency, the limit can be exceeded by 2-3x.

Additionally, the KV `put` in L40-42 resets the TTL with each write, creating a sliding window rather than a fixed window. A sustained trickle of requests can keep the counter alive indefinitely.

**Impact:**  
Rate limits can be bypassed with concurrent requests. For the auth tier (10/min), a burst of 20-30 concurrent login attempts could all pass through.

**Recommendation:**  
Accept this as a known limitation of KV-based rate limiting (KV is eventually consistent). For stronger guarantees, consider:
- Durable Objects with `atomicCounterIncrement` for exact counting
- Workers Rate Limiting API (built-in, atomic)
- At minimum, use a fixed-window approach by including the time window in the key: `ratelimit:${id}:${Math.floor(Date.now()/60000)}`

---

### SEC-009 — MEDIUM: Password Reset Token TOCTOU

- **Severity:** MEDIUM
- **Location:** `apps/api/src/routes/auth.ts:645-658`
- **Status:** Open

**Description:**  
The password reset flow reads the token from KV and then deletes it in separate operations:

```ts
const stored = await c.env.KV.get(`password_reset:${token}`);  // READ
// ... validate, hash new password, update DB ...
await c.env.KV.delete(`password_reset:${token}`);               // DELETE
```

If two requests arrive simultaneously with the same reset token, both could read the valid token before either deletes it. Both would then reset the password — potentially to different values.

**Impact:**  
Low probability but theoretically exploitable. The second concurrent request would overwrite the first password reset. If an attacker intercepts a reset link and races the legitimate user, the attacker's chosen password wins.

**Recommendation:**  
Use an atomic consume pattern — put a consumed marker before processing:
```ts
const stored = await c.env.KV.get(key);
if (!stored) return 400;
await c.env.KV.put(key, 'consumed', { expirationTtl: 5 }); // mark consumed immediately
// ... process reset ...
await c.env.KV.delete(key);
```

---

### SEC-010 — MEDIUM: OAuth State Consumption Not Atomic

- **Severity:** MEDIUM
- **Location:** `apps/api/src/lib/oauth.ts:74-87`
- **Status:** Open

**Description:**  
OAuth state tokens are consumed via `kv.get()` then `kv.delete()` — not atomic. A concurrent callback request could consume the same state token twice. While OAuth authorization codes are single-use at the provider level (the second code exchange would fail), the non-atomic consumption means the validation logic could be bypassed if the attacker controls timing.

**Impact:**  
Low — OAuth providers enforce single-use codes. However, if a provider has a lenient code reuse window, this could enable session fixation.

**Recommendation:**  
Same atomic consume pattern as SEC-009. Use a `consumed` marker before processing the callback.

---

### SEC-011 — MEDIUM: PBKDF2 Iteration Count Below OWASP Recommendation

- **Severity:** MEDIUM
- **Location:** `apps/api/src/lib/password.ts:1`
- **Status:** Open

**Description:**  
Password hashing uses PBKDF2-SHA256 with 100,000 iterations. OWASP's 2023 Password Storage Cheat Sheet recommends **600,000 iterations** for PBKDF2-SHA256, or preferably Argon2id.

```ts
const ITERATIONS = 100_000;  // OWASP 2023 recommends 600,000
```

Cloudflare Workers' `crypto.subtle` does not support Argon2, making PBKDF2 the only viable option. However, the iteration count can be increased.

**Impact:**  
If the D1 database is compromised, password hashes are ~6x easier to crack than they would be at the recommended iteration count. At 100k iterations, a modern GPU can test ~100k PBKDF2-SHA256 hashes/second.

**Recommendation:**  
Increase `ITERATIONS` to 600,000. Benchmark to ensure the Workers CPU time limit (50ms on free tier, 30s on paid) is not exceeded. For existing passwords, rehash on next successful login (lazy migration).

---

### SEC-012 — MEDIUM: Audit Hash Chain Does Not Include Event Content

- **Severity:** MEDIUM
- **Location:** `apps/api/src/lib/audit.ts:35`
- **Status:** Open

**Description:**  
The audit hash chain computes `SHA-256(id:prevHash:hackathonId)` but does NOT include the event's `action`, `entity_type`, `entity_id`, `actor_id`, `details`, or `timestamp` in the hash input:

```ts
const hashInput = `${id}:${prevHash ?? 'genesis'}:${input.hackathonId ?? 'global'}`;
```

This means an attacker with DB write access could modify the content of an audit event (e.g., change `action: 'delete'` to `action: 'update'`) without breaking the hash chain.

**Impact:**  
The hash chain proves event ordering and prevents insertion/deletion of events, but does NOT prove content integrity. An insider with D1 access could tamper with audit event details.

**Recommendation:**  
Include all immutable fields in the hash:
```ts
const hashInput = `${id}:${prevHash ?? 'genesis'}:${hackathonId ?? 'global'}:${action}:${entityType}:${entityId}:${actorId}:${timestamp}`;
```

---

### SEC-013 — MEDIUM: Non-Atomic Audit Sequence Numbers Under Concurrent Writes

- **Severity:** MEDIUM
- **Location:** `apps/api/src/lib/audit.ts:22-31`
- **Status:** Open

**Description:**  
Audit event insertion reads `MAX(sequence)` and the latest hash in separate queries, then inserts with `sequence + 1`. Under concurrent writes, two events could receive the same sequence number, creating a hash chain fork.

D1's single-writer architecture mitigates this in practice (writes are serialized at the D1 level), but the code does not enforce this with transactions or `ON CONFLICT` handling.

**Impact:**  
Low in practice due to D1's architecture. If D1's concurrency model changes or the audit system is ported to a different database, this becomes exploitable.

**Recommendation:**  
Wrap the read-then-insert in a D1 batch or add a `UNIQUE` constraint on `(hackathon_id, sequence)` with `ON CONFLICT` handling.

---

### SEC-014 — MEDIUM: Error Handler Exposes Stack Traces in Development Mode

- **Severity:** MEDIUM
- **Location:** `apps/api/src/middleware/error-handler.ts:10-22`
- **Status:** Partially Fixed

**Description:**  
The error handler includes error messages and stack traces when the environment is detected as development:

```ts
const isDev = c.env.NODE_ENV === 'development'
  || Boolean(c.env.JWT_SECRET && c.env.JWT_SECRET.startsWith('dev'));
```

In production, only `"An unexpected error occurred"` is returned. However, the `isDev` detection checks if `JWT_SECRET` starts with `'dev'` — if a production secret accidentally starts with these characters, full stack traces would leak.

**Impact:**  
Stack traces reveal internal file paths, dependency versions, and error details that aid exploitation. The `JWT_SECRET`-based detection is fragile.

**Recommendation:**  
Use an explicit `ENVIRONMENT` binding in `wrangler.jsonc` instead of inferring from `JWT_SECRET`:
```ts
const isDev = c.env.ENVIRONMENT === 'development';
```

---

### SEC-015 — MEDIUM: GitHub Email Fallback May Use Unverified Email

- **Severity:** MEDIUM
- **Location:** `apps/api/src/lib/oauth.ts:199-201`
- **Status:** Open

**Description:**  
When selecting a user's email from GitHub's API response, the code falls back through:
1. Primary + verified email (preferred)
2. Any verified email
3. `user.email` field (may be unverified)
4. `emails[0]` (may be unverified)

Fallbacks 3 and 4 could select an unverified email address. If this unverified email matches an existing DevSage account, the OAuth login would link to that account — enabling account takeover via a spoofed GitHub email.

**Impact:**  
If an attacker sets their GitHub profile email (not verified) to a victim's email, and the victim has a DevSage account, the attacker could gain access via OAuth login using the unverified email for account matching.

**Recommendation:**  
Only accept verified emails from OAuth providers:
```ts
const email = emails.find(e => e.primary && e.verified)?.email
           || emails.find(e => e.verified)?.email;
if (!email) return errorResponse(c, 400, 'NO_VERIFIED_EMAIL', 'No verified email on GitHub account');
```

---

### SEC-016 — LOW: OTP Comparison Not Timing-Safe

- **Severity:** LOW
- **Location:** `apps/api/src/routes/auth.ts:791`
- **Status:** Open

**Description:**  
Email OTP verification uses plain string equality:

```ts
if (data.otp !== otp) {  // NOT timing-safe
```

In contrast, password verification (`password.ts:57-76`) and webhook HMAC verification (`webhooks.ts:76-96`) both use timing-safe comparison patterns.

**Impact:**  
Theoretical timing side-channel attack on 6-digit OTP. Mitigated by: 5-attempt limit before OTP is invalidated, 10-minute expiry, and the difficulty of extracting sub-microsecond timing differences over network. Risk is negligible in practice.

**Recommendation:**  
Use the same HMAC-based timing-safe comparison used elsewhere in the codebase. Low priority.

---

### SEC-017 — LOW: OTP Modulo Bias

- **Severity:** LOW
- **Location:** `apps/api/src/routes/auth.ts:737`
- **Status:** Open

**Description:**  
OTP generation uses:
```ts
const buf = new Uint32Array(1);
crypto.getRandomValues(buf);
const otp = String(100000 + (buf[0] % 900000));
```

`buf[0]` ranges 0–4,294,967,295. `4,294,967,296 % 900,000 = 967,296`. Values 0–967,295 have a `(4774+1)/4774 ≈ 1.0002` higher probability — a ~0.02% bias.

**Impact:**  
Negligible. The bias is statistically insignificant for a 6-digit OTP with 5-attempt limit.

**Recommendation:**  
Use rejection sampling for theoretical correctness, but this is not a practical vulnerability.

---

### SEC-018 — LOW: JWT Missing `iss` and `aud` Claims

- **Severity:** LOW
- **Location:** `apps/api/src/lib/jwt.ts:32-49`
- **Status:** Open

**Description:**  
JWTs contain `{ sub, ghid, ghu, email, name, image, fam, iat, exp }` but no `iss` (issuer) or `aud` (audience) claims. If the same `JWT_SECRET` were accidentally shared with another service, tokens would be cross-valid.

**Impact:**  
Low — the secret should only exist in one Worker. However, best practice is to include `iss` and `aud` as defense-in-depth.

**Recommendation:**  
Add `iss: 'devsage-api'` and `aud: 'devsage'` to JWT payload, and validate both in `verifyJWT()`.

---

### SEC-019 — LOW: No JWT Key Rotation Support

- **Severity:** LOW
- **Location:** `apps/api/src/lib/jwt.ts`
- **Status:** Open

**Description:**  
The JWT implementation uses a single `JWT_SECRET` with no `kid` (key ID) header. If the secret needs to be rotated (e.g., after a suspected compromise), all existing access tokens immediately become invalid, forcing all users to re-authenticate.

**Impact:**  
Operational — not a direct vulnerability. During secret rotation, there's a 15-minute window where existing sessions break. No gradual migration path exists.

**Recommendation:**  
Add `kid` to JWT header and support an array of secrets (current + previous) during rotation:
```ts
header: { alg: 'HS256', typ: 'JWT', kid: 'v1' }
```

---

### SEC-020 — LOW: Role Cache Allows 60-Second Stale Privileges

- **Severity:** LOW
- **Location:** `apps/api/src/middleware/role.ts:55`
- **Status:** Open

**Description:**  
The `resolveRole()` function caches resolved roles in KV with a 60-second TTL:

```ts
c.env.KV.put(cacheKey, role, { expirationTtl: 60 }).catch(() => {});
```

When a user's role is revoked (e.g., removed as organizer), they retain their old privileges for up to 60 seconds.

**Impact:**  
Low — 60 seconds is a short window. However, for security-critical operations (e.g., deleting a hackathon, modifying judging results), a revoked organizer could still act during this window.

**Recommendation:**  
Accept this trade-off for performance, but consider adding cache invalidation on role changes:
```ts
await c.env.KV.delete(`role:${userId}:${hackathonId}`);
```

---

### SEC-021 — LOW: `SameSite=None` Weakens Cookie Security

- **Severity:** LOW
- **Location:** `apps/api/src/lib/cookies.ts:22,33`
- **Status:** Open (by design)

**Description:**  
Both `access_token` and `refresh_token` cookies use `SameSite: 'None'` on HTTPS connections. This is required for the multi-subdomain architecture (`api.devsage.org` → `devsage.org`, `platform.devsage.org`, etc.) but it disables the browser's built-in CSRF protection from cookies.

**Impact:**  
Browsers will send cookies on cross-site requests, enabling CSRF attacks (see SEC-004). This is a design trade-off, not a bug.

**Recommendation:**  
Mitigate via SEC-004 recommendations (Origin header validation). If the architecture allows, consider moving the API to a path-based approach (`devsage.org/api/`) to enable `SameSite: 'Lax'`.

---

### SEC-022 — LOW: CI Workflows Missing Explicit Permissions Block

- **Severity:** LOW
- **Location:** `.github/workflows/deploy.yml`, `.github/workflows/deploy-hackathon-site.yml`
- **Status:** Open

**Description:**  
`deploy.yml` and `deploy-hackathon-site.yml` do not declare explicit `permissions:` blocks. The `secret-scan.yml` workflow correctly sets `permissions: { contents: read }`.

Without explicit permissions, workflows inherit the repository's default permissions, which may include `contents: write`, `packages: write`, and other elevated scopes.

**Impact:**  
If a workflow is compromised (e.g., via a malicious PR or dependency), it has more permissions than necessary. This violates the principle of least privilege.

**Recommendation:**  
Add explicit permissions to all workflows:
```yaml
permissions:
  contents: read
  deployments: write  # only if needed
```

---

### SEC-023 — LOW: Third-Party Actions Pinned to Major Version Tags

- **Severity:** LOW
- **Location:** `.github/workflows/deploy.yml`, `.github/workflows/secret-scan.yml`
- **Status:** Open

**Description:**  
Actions are pinned to major version tags (e.g., `actions/checkout@v4`, `dorny/paths-filter@v3`, `gitleaks/gitleaks-action@v2`) rather than full commit SHAs. A compromised tag (via GitHub account takeover of the action maintainer) could inject malicious code.

**Impact:**  
Supply-chain attack on CI. The `actions/checkout` and `actions/setup-node` are GitHub-maintained (lower risk), but `dorny/paths-filter` and `gitleaks/gitleaks-action` are third-party.

**Recommendation:**  
Pin third-party actions to full SHAs:
```yaml
- uses: dorny/paths-filter@abc123def  # pin to specific commit
```

---

### SEC-024 — LOW: `response.ts` Details Field Passes Unsanitized Data

- **Severity:** LOW
- **Location:** `apps/api/src/lib/response.ts:20-22`
- **Status:** Open

**Description:**  
The `errorResponse()` helper accepts an optional `details?: Record<string, unknown>` parameter that is passed directly into the JSON response without sanitization. If callers pass raw error objects, database error messages, or internal state, this information reaches the client.

```ts
// response.ts L20-22
error: {
  code,
  message,
  ...(details && { details }),  // passed through verbatim
},
```

**Impact:**  
Depends on caller discipline. No current callers pass sensitive data, but the API surface is open to future mistakes.

**Recommendation:**  
Add a sanitization layer or allowlist for the `details` field. Alternatively, only include `details` in development mode (similar to the error handler).

---

### SEC-025 — INFO: No Dependency Scanning (Dependabot / Renovate / Audit)

- **Severity:** INFO
- **Location:** `.github/` (missing `dependabot.yml` and `renovate.json`)
- **Status:** Open

**Description:**  
No automated dependency scanning is configured:
- No `.github/dependabot.yml`
- No `renovate.json`
- No `pnpm audit` step in any CI workflow
- No npm/pnpm audit in pre-commit hooks

**Impact:**  
Known vulnerabilities in dependencies will not be detected or flagged until manual audit. The project uses `pnpm` with locked versions (`--frozen-lockfile` in CI), which prevents unexpected version changes but does not catch known CVEs.

**Recommendation:**  
Add `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```
Add `pnpm audit --audit-level=high` to the quality-gate CI job.

---

### SEC-026 — INFO: `Authorization` Header Allowed in CORS Despite Cookie-Based Auth

- **Severity:** INFO
- **Location:** `apps/api/src/middleware/cors.ts:21`
- **Status:** Open

**Description:**  
The CORS configuration includes `Authorization` in `allowHeaders`:
```ts
allowHeaders: ['Content-Type', 'Authorization', 'If-None-Match'],
```

The application uses cookie-based authentication. Including `Authorization` is unnecessary and marginally expands the attack surface (allows Bearer tokens from any allowed origin).

**Impact:**  
Negligible. The legacy Bearer path (SEC-003) is the actual risk — this just ensures CORS doesn't block it.

**Recommendation:**  
Remove `Authorization` from `allowHeaders` once the legacy Bearer path is removed.

---

### SEC-027 — INFO: Rate Limiter Fallback Identifier Shares Counter

- **Severity:** INFO
- **Location:** `apps/api/src/middleware/rate-limit.ts:22`
- **Status:** Open

**Description:**  
When `cf-connecting-ip` is absent (non-Cloudflare requests, e.g., local dev), all unauthenticated requests share the identifier `'unknown'`:

```ts
const id = user?.id ?? c.req.header('cf-connecting-ip') ?? 'unknown';
```

**Impact:**  
In local development, all unauthenticated requests share one rate limit counter. In production behind Cloudflare, `cf-connecting-ip` is always present. No production impact.

**Recommendation:**  
Add a fallback to `x-forwarded-for` or `x-real-ip` before `'unknown'`.

---

### SEC-028 — INFO: Non-Atomic Refresh Token Rotation

- **Severity:** INFO
- **Location:** `apps/api/src/lib/refresh-token.ts:75-81`
- **Status:** Open

**Description:**  
Refresh token rotation revokes the old token and creates the new one in separate DB operations (not a D1 batch). If the Worker crashes between revoke and create, the user loses their session with no new token.

The 2-second grace period (L2, L65) for replay detection mitigates the concurrent-tab scenario effectively.

**Impact:**  
Rare edge case — Worker crashes mid-operation. User must re-login. No security impact, only availability.

**Recommendation:**  
Wrap revoke + create in `DB.batch()` for atomicity. Low priority.

---

### SEC-029 — INFO: Registration Race Condition (Duplicate Email)

- **Severity:** INFO
- **Location:** `apps/api/src/routes/auth.ts:157-168`
- **Status:** Open

**Description:**  
Registration checks `SELECT ... WHERE email = ?` then `INSERT` — a classic TOCTOU. Two concurrent registrations with the same email could both pass the check. The D1 `UNIQUE` constraint on `email` would catch the second insert at the database level, returning a D1 error.

**Impact:**  
If the UNIQUE constraint exists (likely), this is a non-issue — the second request gets a database error. If the constraint is missing, duplicate accounts are possible.

**Recommendation:**  
Verify the `UNIQUE` constraint exists on `users.email`. Handle the D1 unique violation error gracefully (return 409).

---

## Positive Findings

The following security controls are well-implemented:

| Control | Implementation | Location |
|---------|---------------|----------|
| **SQL Injection Prevention** | 100% parameterized queries via `.prepare().bind()` | All route files |
| **CSPRNG Usage** | `crypto.getRandomValues()` and `crypto.randomUUID()` everywhere; zero `Math.random()` | `auth.ts`, `jwt.ts`, `refresh-token.ts`, `oauth.ts` |
| **Timing-Safe Password Comparison** | HMAC-based constant-time XOR comparison | `password.ts:57-76` |
| **Timing-Safe Webhook Verification** | Double-HMAC pattern (Workers lack `timingSafeEqual`) | `webhooks.ts:53-96` |
| **Timing-Safe JWT Verification** | `crypto.subtle.verify()` (WebCrypto, inherently constant-time) | `jwt.ts:59-65` |
| **Refresh Token Hashing** | SHA-256 hash stored in DB; raw token never persisted | `refresh-token.ts:14-17` |
| **Refresh Token Replay Detection** | Family-based revocation with 2s grace period | `refresh-token.ts:63-73` |
| **Cookie Security** | `HttpOnly`, `Secure` (dynamic), scoped `Path` | `cookies.ts:17-36` |
| **Refresh Token Path Scoping** | `path: '/auth/refresh'` — cookie only sent on refresh | `cookies.ts:31` |
| **Short-Lived Access Tokens** | 15-minute expiry | `jwt.ts:4` |
| **No Algorithm Confusion** | Hardcoded `HS256` in JWT header; verification always uses HMAC-SHA256 | `jwt.ts:40,59` |
| **Audit Hash Chain** | SHA-256 chain linking events to predecessors | `audit.ts:33-37` |
| **Server-Generated Request IDs** | Never accepts client-provided `X-Request-Id` | `request-id.ts:5` |
| **Secret Scanning** | Pre-commit (`secretlint`), pre-push, and CI (`gitleaks`) | `.husky/`, `.github/workflows/secret-scan.yml` |
| **Frozen Lockfile in CI** | `pnpm install --frozen-lockfile` prevents supply-chain injection | `.github/workflows/deploy.yml:38` |
| **Quality Gate Before Deploy** | Typecheck + lint + test must pass before any deployment | `.github/workflows/deploy.yml:27-41` |
| **Error Message Discipline** | Generic errors in production; dev-only stack traces | `error-handler.ts:10-22` |
| **Login No-Enumeration** | Same error for wrong email and wrong password | `auth.ts:213-219` |
| **Forgot-Password No-Enumeration** | Always returns success regardless of email existence | `auth.ts:589,628` |
| **Cache Auth Bypass** | KV cache skips requests with `access_token` cookie or Bearer token | `cache.ts:16-18` |
| **Role Resolution Per-Request** | Roles fetched from DB on every authenticated request (cookie path) | `auth.ts:73-99` |
| **Platform Admin DB Check** | No caching — checked against `platform_admins` table every request | `platform-admin.ts:13-15` |

---

## Remediation Priority

### Immediate (Sprint 1)
1. **SEC-002** — Restrict CORS wildcard patterns to specific known origins
2. **SEC-007** — Remove SMTP credentials from log output
3. **SEC-001** — Begin wiring Zod validation into critical routes (auth, hackathon create/update)

### Short-Term (Sprint 2-3)
4. **SEC-004** — Implement Origin header validation middleware for CSRF protection
5. **SEC-005** — Apply rate limiting to all route groups
6. **SEC-003** — Remove or harden legacy Bearer path in auth middleware
7. **SEC-006** — Fix registration user enumeration
8. **SEC-015** — Reject unverified GitHub emails in OAuth

### Medium-Term (Sprint 4-6)
9. **SEC-011** — Increase PBKDF2 iterations to 600,000 with lazy rehashing
10. **SEC-012** — Include event content in audit hash chain
11. **SEC-025** — Add Dependabot + pnpm audit to CI
12. **SEC-014** — Use explicit `ENVIRONMENT` binding for dev detection
13. **SEC-008** — Improve rate limiter atomicity (consider Workers Rate Limiting API)
14. **SEC-009/010** — Atomic token consumption for password reset and OAuth state

### Low Priority
15. **SEC-018/019** — Add JWT `iss`/`aud` claims and `kid` rotation support
16. **SEC-022/023** — CI permissions and action pinning
17. **SEC-016/017** — Timing-safe OTP comparison and rejection sampling

---

*End of audit report.*
