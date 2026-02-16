# Token Lifecycle

> `apps/api/src/lib/jwt.ts` + `apps/api/src/lib/refresh-token.ts` — JWT creation/verification and refresh token rotation with replay detection.

## JWT (Access Token)

### Signing

```ts
// Algorithm: HMAC SHA-256 via crypto.subtle
// No external JWT libraries

async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + JWT_EXPIRY_SECONDS };
  // base64url(header) + '.' + base64url(payload) + '.' + base64url(signature)
}
```

### Verification

```ts
async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  // 1. Split token into parts
  // 2. Verify HMAC-SHA256 signature via crypto.subtle
  // 3. Check exp > now
  // 4. Return payload or null
}
```

### Payload Shape

```ts
interface JWTPayload {
  sub: string;   // user UUID (primary key in users table)
  ghid?: number; // GitHub user ID (absent for Google-only users)
  ghu?: string;  // GitHub username (absent for Google-only users)
  fam: string;   // token family ID (links to refresh_tokens.family_id)
  iat: number;   // issued at (Unix seconds)
  exp: number;   // expires at (Unix seconds)
}
```

**Important:** Roles are NOT in the JWT. They are resolved per-request from the database.

## Refresh Token

### Creation

```ts
async function createRefreshToken(db, userId: string): Promise<{ token: string; familyId: string }> {
  const familyId = crypto.randomUUID();
  const bytes = new Uint8Array(REFRESH_TOKEN_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); // opaque hex
  const hash = await sha256(raw);                      // stored in DB

  await db.insert(refreshTokens).values({
    id: crypto.randomUUID(),
    user_id: userId,
    family_id: familyId,
    token_hash: hash,
    expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000).toISOString(),
    created_at: new Date().toISOString(),
  });

  return { token: raw, familyId };
}
```

### Rotation

```ts
async function rotateRefreshToken(db, oldToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  // 1. Hash the incoming token
  // 2. Find matching row in refresh_tokens (by token_hash, not revoked, not expired)
  // 3. Check reuse:
  //    - If token already used (revoked_at set) AND outside 2s grace period:
  //      → REPLAY DETECTED → revoke entire family → return null
  //    - If within 2s grace (concurrent request): allow
  // 4. Mark old token as revoked (set revoked_at)
  // 5. Generate new refresh token in same family
  // 6. Sign new JWT
  // 7. Return both tokens
}
```

### Replay Detection

Family-based replay detection prevents stolen refresh tokens from being used:

```
Normal flow:
  Token A (family=X) → rotate → Token B (family=X) → rotate → Token C (family=X)

Replay attack:
  Attacker steals Token A
  Legitimate user rotates A → B
  Attacker tries A → A is revoked → ENTIRE family X revoked
  Both attacker and user must re-authenticate
```

The 2-second grace period handles legitimate concurrent requests (e.g., multiple tabs refreshing simultaneously). D1 writes take 5-30ms+, so a wider window is needed.

### Revoking a Family

```ts
async function revokeTokenFamily(db, familyId: string): Promise<void> {
  await db.update(refreshTokens)
    .set({ revoked_at: new Date().toISOString() })
    .where(eq(refreshTokens.family_id, familyId));
}
```

## Constants

```ts
const JWT_EXPIRY_SECONDS = 900;           // 15 minutes
const REFRESH_TOKEN_EXPIRY_SECONDS = 2592000; // 30 days
const REFRESH_TOKEN_BYTE_LENGTH = 32;     // 256-bit random
const REUSE_GRACE_PERIOD_MS = 2000;       // 2 seconds — D1 writes take 5-30ms+, concurrent tab refreshes need a wider window
```

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `AUTH_TOKEN_EXPIRED` | 401 | JWT exp < now |
| `AUTH_TOKEN_INVALID` | 401 | JWT signature verification failed |
| `AUTH_REFRESH_INVALID` | 401 | Refresh token not found or expired |
| `AUTH_REFRESH_REUSE` | 401 | Refresh token replay detected — family revoked |

## Edge Cases

- **Multiple concurrent refresh requests from the same browser (e.g., multiple tabs).** The 2-second grace period allows the first few through. Subsequent requests succeed because they find the newly issued token within the grace window.
- **Refresh token used after family revocation.** Return `AUTH_REFRESH_REUSE`, force re-login. The entire family is already revoked, so no further tokens in that chain work.
- **JWT clock skew (Workers run on edge, slight time differences).** Add 30-second leeway to the `exp` check so tokens aren't rejected prematurely on edge nodes with minor clock drift.
- **Token rotation during network failure (client sends old token that was rotated server-side).** The old token is already revoked. This looks identical to a replay attack, so the family gets revoked for safety. User must re-login.

## Done When

- [ ] signJWT produces valid JWT with correct payload and HS256 signature
- [ ] verifyJWT validates signature and expiration (with 30s leeway)
- [ ] createRefreshToken creates family + hashed token in DB
- [ ] rotateRefreshToken issues new token, revokes old, same family
- [ ] Replay detection: reuse of revoked token revokes entire family
- [ ] 2-second grace period handles concurrent tab refreshes
- [ ] Unit tests for sign/verify/rotate/replay
