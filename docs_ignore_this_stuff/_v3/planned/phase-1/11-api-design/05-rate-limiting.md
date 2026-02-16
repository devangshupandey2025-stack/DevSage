# Rate Limiting

> `apps/api/src/middleware/rate-limit.ts` — Per-IP/per-user rate limiting via KV.

## Phase 1 vs Phase 2

KV writes are limited to **1,000/day on the free plan**. Writing a counter on every request would exhaust this limit quickly. Phase 1 rate limits **auth endpoints only** (highest abuse risk). Full rate limiting is enabled on the paid plan (Phase 2+).

| Tier | Limit | Window | Applied To | Phase |
|------|-------|--------|-----------|-------|
| `auth` | 10 req | 60s | `/auth/*` endpoints | **Phase 1** |
| `webhook` | 1000 req | 60s | `/webhooks/*` | Phase 2 |
| `admin` | 100 req | 60s | `/api/v1/admin/*` | Phase 2 |
| `authenticated` | 300 req | 60s | Authenticated API requests | Phase 2 |
| `anonymous` | 60 req | 60s | Unauthenticated API requests | Phase 2 |

### Phase 1 KV Write Budget

| Source | Estimated KV writes/day | Notes |
|--------|------------------------|-------|
| Auth rate limiting | ~10–50 | Only 10 req/min limit, low volume |
| OAuth state storage | ~10–20 | `PUT` state param, 10-min TTL |
| **Total** | **~30–70** | Well under 1,000/day limit |

## Implementation

```ts
// Rate limit tier configuration
type RateLimitTier = 'auth' | 'webhook' | 'admin' | 'authenticated' | 'anonymous';

const RATE_LIMIT_TIERS: Record<RateLimitTier, { limit: number; windowSeconds: number }> = {
  auth:          { limit: 10,   windowSeconds: 60 },
  webhook:       { limit: 1000, windowSeconds: 60 },
  admin:         { limit: 100,  windowSeconds: 60 },
  authenticated: { limit: 300,  windowSeconds: 60 },
  anonymous:     { limit: 60,   windowSeconds: 60 },
};

// Phase 1: Only rate limit auth endpoints (free tier KV write constraint)
// Phase 2+: Enable all tiers on paid plan
const ENABLED_TIERS: Set<RateLimitTier> = new Set(['auth']);

function determineTier(path: string, isAuthenticated: boolean): RateLimitTier | null {
  if (path.startsWith('/auth/')) return 'auth';
  if (path.startsWith('/webhooks/')) return 'webhook';
  if (path.startsWith('/api/v1/admin/')) return 'admin';
  return isAuthenticated ? 'authenticated' : 'anonymous';
}

const rateLimitMiddleware: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const user = c.get('user');
  const path = c.req.path;

  // Determine tier
  const tier = determineTier(path, !!user);
  if (!tier || !ENABLED_TIERS.has(tier)) {
    // Tier not enabled in this phase — skip rate limiting
    return next();
  }

  const config = RATE_LIMIT_TIERS[tier];

  // Identifier: user ID (authenticated) or IP (anonymous)
  const identifier = user?.sub ?? c.req.header('cf-connecting-ip') ?? 'unknown';

  // Window key
  const windowStart = Math.floor(Date.now() / (config.windowSeconds * 1000));
  const key = `rl:${tier}:${identifier}:${windowStart}`;

  // Check current count (KV read — 100K/day on free tier, plentiful)
  const current = parseInt(await c.env.KV.get(key) ?? '0');

  if (current >= config.limit) {
    const resetAt = (windowStart + 1) * config.windowSeconds;
    c.header('Retry-After', String(resetAt - Math.floor(Date.now() / 1000)));
    c.header('X-RateLimit-Limit', String(config.limit));
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', String(resetAt));
    return errorResponse(c, 429, 'RATE_LIMITED', 'Too many requests');
  }

  // Increment (fire-and-forget — this is the KV write)
  c.executionCtx.waitUntil(
    c.env.KV.put(key, String(current + 1), { expirationTtl: config.windowSeconds })
  );

  // Set headers
  c.header('X-RateLimit-Limit', String(config.limit));
  c.header('X-RateLimit-Remaining', String(config.limit - current - 1));
  c.header('X-RateLimit-Reset', String((windowStart + 1) * config.windowSeconds));

  await next();
};
```

## Response Headers

Every response includes rate limit headers (when the tier is enabled):

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Unix timestamp when window resets |
| `Retry-After` | Seconds to wait (only on 429) |

## KV Key Format

```
rl:{tier}:{identifier}:{window}
```

Example: `rl:auth:203.0.113.42:28614573`

KV TTL is set to the window duration — keys auto-expire (no delete operations needed).

## Implementation Notes

- KV is eventually consistent — rate limits are approximate (acceptable for abuse prevention)
- `waitUntil()` for KV writes to avoid blocking the response
- IP from `cf-connecting-ip` header (Cloudflare-provided, reliable)
- Webhook tier is high (1000/min) because GitHub can burst many events
- **Free tier guard:** `ENABLED_TIERS` set controls which tiers are active — change this set when upgrading to paid plan
- Race condition on concurrent increments is acceptable — worst case: a few extra requests slip through
