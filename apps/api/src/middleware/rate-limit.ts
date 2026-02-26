import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';

interface RateLimitConfig {
  max: number;
  windowSeconds: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth: { max: 10, windowSeconds: 60 },
  api: { max: 100, windowSeconds: 60 },
  webhook: { max: 200, windowSeconds: 60 },
  admin: { max: 50, windowSeconds: 60 },
};

export function rateLimitMiddleware(tier: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const config = RATE_LIMITS[tier];
    if (!config) return next(); // No rate limit for this tier in Phase 1

    const user = c.get('user');
    const identifier = user?.id ?? c.req.header('cf-connecting-ip') ?? 'unknown';
    const key = `rl:${tier}:${identifier}`;

    const current = await c.env.KV.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= config.max) {
      c.header('Retry-After', String(config.windowSeconds));
      c.header('X-RateLimit-Limit', String(config.max));
      c.header('X-RateLimit-Remaining', '0');
      return c.json(
        { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
        429
      );
    }

    // Increment counter (fire-and-forget via waitUntil if available)
    const newCount = count + 1;
    const putPromise = c.env.KV.put(key, String(newCount), {
      expirationTtl: config.windowSeconds,
    });

    // Use waitUntil if available for non-blocking KV write
    c.executionCtx?.waitUntil(putPromise);

    c.header('X-RateLimit-Limit', String(config.max));
    c.header('X-RateLimit-Remaining', String(config.max - newCount));

    return next();
  };
}
