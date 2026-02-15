import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env.js';

/**
 * Rate limit tiers per v3 api-design spec.
 * Uses KV sliding-window counters keyed by tier:identifier:window.
 */
interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

const TIERS: Record<string, RateLimitConfig> = {
  auth: { limit: 10, windowSeconds: 60 },
  admin: { limit: 100, windowSeconds: 60 },
  webhook: { limit: 1000, windowSeconds: 60 },
  authenticated: { limit: 300, windowSeconds: 60 },
  anonymous: { limit: 60, windowSeconds: 60 },
};

function getTier(path: string, userId: string | undefined): { tier: string; key: string; config: RateLimitConfig } {
  if (path.startsWith('/auth')) {
    return { tier: 'auth', key: '', config: TIERS.auth };
  }
  if (path.startsWith('/api/v1/admin')) {
    return { tier: 'admin', key: userId || '', config: TIERS.admin };
  }
  if (path.startsWith('/webhooks')) {
    return { tier: 'webhook', key: '', config: TIERS.webhook };
  }
  if (userId) {
    return { tier: 'authenticated', key: userId, config: TIERS.authenticated };
  }
  return { tier: 'anonymous', key: '', config: TIERS.anonymous };
}

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || '0.0.0.0';
}

/**
 * Per-IP/per-user rate limiting via KV.
 * Sets X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers.
 * Returns 429 with Retry-After when limit exceeded.
 * Fail-open: if KV is unavailable, requests pass through.
 */
export const rateLimitMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const path = new URL(c.req.url).pathname;
  // User may not be resolved yet at this point in the middleware chain;
  // auth middleware runs after rate limiter per the v3 spec chain:
  // CORS → Request ID → Rate Limiter → Error Handler → Auth → Role → Handler
  // So we check if user was already set (won't be on first pass).
  const userId = (c.get('user' as never) as { sub?: string } | undefined)?.sub;
  const ip = getClientIp(c);

  const { tier, key, config } = getTier(path, userId);
  const identifier = key || ip;
  const windowStart = Math.floor(Date.now() / 1000 / config.windowSeconds);
  const kvKey = `rl:${tier}:${identifier}:${windowStart}`;

  try {
    const current = await c.env.KV.get(kvKey);
    const count = current ? parseInt(current, 10) : 0;

    const resetAt = (windowStart + 1) * config.windowSeconds;
    const remaining = Math.max(0, config.limit - count - 1);

    // Set rate limit headers on all responses
    c.header('X-RateLimit-Limit', String(config.limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetAt));

    if (count >= config.limit) {
      const retryAfter = resetAt - Math.floor(Date.now() / 1000);
      c.header('Retry-After', String(Math.max(1, retryAfter)));
      return c.json(
        {
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Too many requests. Please retry after ${Math.max(1, retryAfter)} seconds.`,
            details: {
              limit: config.limit,
              remaining: 0,
              reset_at: new Date(resetAt * 1000).toISOString(),
              retry_after: Math.max(1, retryAfter),
            },
          },
        },
        429 as never,
      );
    }

    // Increment counter with TTL matching the window
    await c.env.KV.put(kvKey, String(count + 1), { expirationTtl: config.windowSeconds * 2 });
  } catch (error) {
    // Fail-open: if KV is unavailable, allow the request through
    console.warn('Rate limiter KV error (fail-open):', error instanceof Error ? error.message : String(error));
  }

  await next();
};
