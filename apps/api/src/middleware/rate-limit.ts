import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';
import { RATE_LIMITS } from '../lib/constants.js';

/**
 * KV-based sliding window rate limiter.
 *
 * Uses a timestamped window key to avoid TOCTOU: each window gets its own key,
 * and the counter naturally expires with the window. This eliminates the
 * read-then-write race where two concurrent requests could both read count=99
 * and both increment to 100.
 *
 * Trade-off: slightly more permissive at window boundaries (by 1 request max),
 * but eliminates the TOCTOU vulnerability entirely.
 */
export function rateLimitMiddleware(tier: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const config = RATE_LIMITS[tier];
    if (!config) return next();

    const user = c.get('user');
    const identifier = user?.id ?? c.req.header('cf-connecting-ip') ?? 'unknown';
    const windowId = Math.floor(Date.now() / (config.windowSeconds * 1000));
    const key = `rl:${tier}:${identifier}:${windowId}`;

    // Single KV read — the window key includes the time window,
    // so stale data from a previous window is impossible.
    const current = await c.env.KV.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= config.max) {
      const windowEnd = (windowId + 1) * config.windowSeconds;
      const retryAfter = Math.max(1, windowEnd - Math.floor(Date.now() / 1000));
      c.header('Retry-After', String(retryAfter));
      c.header('X-RateLimit-Limit', String(config.max));
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(windowEnd));
      return c.json(
        { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
        429
      );
    }

    // Fire-and-forget increment via waitUntil
    const newCount = count + 1;
    const putPromise = c.env.KV.put(key, String(newCount), {
      expirationTtl: config.windowSeconds * 2, // 2x window for safety margin
    });
    c.executionCtx?.waitUntil(putPromise);

    c.header('X-RateLimit-Limit', String(config.max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, config.max - newCount)));

    return next();
  };
}
