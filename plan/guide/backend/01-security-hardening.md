# Security Hardening

Priority: **BLOCK DEPLOYS** until CRITICAL items resolved. HIGH items before public launch.

## CRITICAL — Must Fix Immediately

### SEC-001: getInstallationToken() Stub
**File**: `src/services/github.ts`
**Problem**: Always returns a stub token, never authenticates with GitHub App. The entire GitHub submission pipeline is broken without real tokens.
**Fix**: See `04-github-integration.md` — this is consolidated there. The RS256 JWT signing function already exists in `services/github.ts` (lines 20-55). Only the `getInstallationToken()` exchange is missing (uses in-memory cache, not KV).

**Also needed**: Add `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` bindings to `apps/api/wrangler.jsonc` and update `src/types/env.ts`.

### SEC-003: Bearer Path Trusts JWT Claims
**File**: `src/middleware/auth.ts`
**Problem**: Legacy `Authorization: Bearer` path reads `user_id` from JWT payload and trusts it without DB verification. Cookie path correctly queries DB.
**Fix**:
1. Remove Bearer path entirely (all clients use cookies), OR
2. Add DB verification: query `users` table to confirm user exists and is not suspended

**Recommendation**: Remove Bearer path. No frontend uses it. If needed for API keys later, implement proper API key auth separately.

**Note**: If keeping Bearer path with `iat` invalidation, a `password_changed_at` column must be added to the `users` table (does NOT currently exist — requires migration).

### SEC-007: SMTP Credentials Logged
**File**: `src/services/smtp.ts`
**Problem**: On connection error, the full SMTP config (including password) is logged via `console.error`.
**Fix**:
1. Redact credentials before logging: `{ ...config, pass: '[REDACTED]' }`
2. Log only: host, port, error message, error code

### ~~SEC-014: Dev-Mode Stack Trace Leak~~ — ALREADY FIXED
**Status**: Resolved. `error-handler.ts` now uses `NODE_ENV` environment variable, not JWT_SECRET prefix. No action needed.

### SEC-015: GitHub OAuth Unverified Email — ESCALATED TO CRITICAL
**File**: `src/lib/oauth.ts`
**Problem**: GitHub may return a non-verified email. Account linking could map to the wrong user, enabling **account takeover**: attacker creates a GitHub account with victim's unverified email, then uses OAuth to hijack victim's DevSage account.
**Fix**:
1. After fetching GitHub profile, call GitHub's `GET /user/emails` API
2. Find the `primary: true, verified: true` email
3. If no verified email found, reject the OAuth flow with an error
4. Only link accounts using verified emails

## HIGH — Before Public Launch

### SEC-006: User Enumeration
**Files**: `src/routes/auth.ts` (register, login, password-reset)
**Problem**: Different error messages for existing vs non-existing email addresses.
**Fix**:
1. Register: return success even if email exists (send "already registered" email to user)
2. Login: generic "invalid credentials" for both wrong email and wrong password
3. Password reset: always return success, only send email if user exists

**Timing side-channel mitigation**: Both the "new user" and "existing user" code paths must take roughly the same time. Add a constant-time delay (e.g., `await new Promise(r => setTimeout(r, 200))`) to the faster path so an attacker cannot distinguish by response time.

### SEC-011: PBKDF2 Iterations
**File**: `src/lib/password.ts`
**Problem**: Using 100,000 iterations. OWASP 2024 recommends 600,000 for PBKDF2-SHA256.
**Fix**:
1. Bump to 600,000 iterations for new passwords
2. Add iteration count prefix to hash format: `$pbkdf2-sha256$600000$salt$hash`
3. On login: if stored hash uses old iteration count, re-hash with 600k and update DB
4. This is a gradual migration — no bulk update needed

**Migration format safety**: Old hashes (without prefix) must be detected by checking if the stored value starts with `$pbkdf2-sha256$`. If not, assume 100k iterations and rehash. Document the exact parsing logic:
```typescript
function parseHashFormat(stored: string): { iterations: number; salt: string; hash: string } {
  if (stored.startsWith('$pbkdf2-sha256$')) {
    const [, , iterations, salt, hash] = stored.split('$');
    return { iterations: parseInt(iterations, 10), salt, hash };
  }
  // Legacy format: raw salt:hash with 100k iterations
  const [salt, hash] = stored.split(':');
  return { iterations: 100_000, salt, hash };
}
```

### SEC-008/009: Rate Limiter TOCTOU
**File**: `src/middleware/rate-limit.ts`
**Problem**: Read-then-write to KV is not atomic. Under high concurrency, multiple requests can pass the limit.
**Fix**:
1. Accept as low-risk for general API rate limiting
2. **Note**: KV `get()` can return stale data for up to 60 seconds (eventual consistency). For auth endpoints (login brute force), this means rate limits could be off by significantly more than a few requests.
3. **KV write limits**: Free plan allows 1,000 writes/day. Each rate-limited request burns a KV write. If this becomes a bottleneck, migrate rate limiting to a Durable Object (exact counting, atomic, no write limits) or D1 with a simple counter table.
4. For auth endpoints specifically, consider adding a per-IP lockout after N failures stored in a Durable Object (exact counting, atomic)
5. Document the trade-off — KV rate limiting is "soft" by design on Workers

### SEC-010: OAuth State Not Atomically Consumed
**File**: `src/lib/oauth.ts`
**Problem**: OAuth state token is checked but not atomically deleted. Replay attack window exists.
**Fix**:
1. Use KV `delete()` + check in single path: read, verify, delete immediately
2. Add 5-minute TTL on state tokens via KV expiry
3. Add `code_verifier` for PKCE (GitHub supports it, Google requires it)

### API-052: Invite Code Modulo Bias
**File**: `src/lib/utils.ts`
**Problem**: `generateInviteCode()` uses modulo on random bytes, creating bias.
**Fix**:
1. Use rejection sampling: generate random byte, reject if >= `256 - (256 % charset.length)`
2. OR use `crypto.getRandomValues(new Uint32Array(length))` with modulo on 32-bit values (bias is negligible at 2^-24)

## Schema Changes Required

| Column/Table | Table | Migration |
|---|---|---|
| `password_changed_at` | `users` | Only if keeping Bearer path (SEC-003) |
| `must_reset_password` | `users` | Needed for judge temp credential flow (see `08-remaining-gaps.md` CG-01) |

## Testing Checklist
- [ ] All auth routes return generic error messages with constant-time responses
- [ ] Bearer path removed or DB-verified
- [ ] SMTP errors don't log credentials
- [ ] SEC-015: OAuth only links verified GitHub emails
- [ ] Password hashes use 600k iterations on new accounts
- [ ] Legacy password hashes (100k, no prefix) still verify correctly
- [ ] OAuth state tokens are single-use
- [ ] Invite codes pass chi-squared uniformity test
