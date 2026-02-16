# Rate Limiting

> `apps/api/src/middleware/rate-limit.ts` — Per-IP/per-user rate limiting via KV.

## Tiers

| Tier | Limit | Window | Applied To |
|------|-------|--------|-----------|
| `auth` | 10 req | 60s | `/auth/*` endpoints |
| `admin` | 100 req | 60s | `/api/v1/admin/*` |
| `webhook` | 1000 req | 60s | `/webhooks/*` |
| `authenticated` | 300 req | 60s | Authenticated API requests |
| `anonymous` | 60 req | 60s | Unauthenticated API requests |

## Implementation

```ts
const rateLimitMiddleware: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const user = c.get('user');
  const path = c.req.path;

  // Determine tier
  const tier = determineTier(path, !!user);
  const config = RATE_LIMIT_TIERS[tier];

  // Identifier: user ID (authenticated) or IP (anonymous)
  const identifier = user?.sub ?? c.req.header('cf-connecting-ip') ?? 'unknown';

  // Window key
  const windowStart = Math.floor(Date.now() / (config.windowSeconds * 1000));
  const key = `rl:${tier}:${identifier}:${windowStart}`;

  // Check current count
  const current = parseInt(await c.env.KV.get(key) ?? '0');

  if (current >= config.limit) {
    const resetAt = (windowStart + 1) * config.windowSeconds;
    c.header('Retry-After', String(resetAt - Math.floor(Date.now() / 1000)));
    c.header('X-RateLimit-Limit', String(config.limit));
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', String(resetAt));
    return errorResponse(c, 429, 'RATE_LIMITED', 'Too many requests');
  }

  // Increment (fire-and-forget)
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

Every response includes rate limit headers:

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

Example: `rl:authenticated:user-uuid-123:28614573`

KV TTL is set to the window duration — keys auto-expire.

## Implementation Notes

- KV is eventually consistent — rate limits are approximate (acceptable)
- `waitUntil()` for KV writes to avoid blocking the response
- IP from `cf-connecting-ip` header (Cloudflare-provided, reliable)
- Webhook tier is high (1000/min) because GitHub can burst many events
