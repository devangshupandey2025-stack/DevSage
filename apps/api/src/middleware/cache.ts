import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';

/**
 * KV-backed response cache for read-heavy public endpoints.
 * Caches full JSON response body in KV with configurable TTL.
 * Uses URL + query params as cache key.
 * Skips caching for authenticated/mutating requests.
 */
export function kvCache(ttlSeconds: number = 30): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    // Only cache GET requests
    if (c.req.method !== 'GET') return next();

    const cacheKey = `cache:${c.req.url}`;

    // Try KV cache
    const cached = await c.env.KV.get(cacheKey);
    if (cached) {
      c.header('X-Cache', 'HIT');
      c.header('Cache-Control', `public, max-age=${ttlSeconds}`);
      return c.json(JSON.parse(cached));
    }

    // Miss — execute handler and capture response
    await next();

    // Only cache successful JSON responses
    if (c.res.status === 200 && c.res.headers.get('content-type')?.includes('json')) {
      const body = await c.res.clone().text();
      // Fire-and-forget KV write
      c.executionCtx.waitUntil(
        c.env.KV.put(cacheKey, body, { expirationTtl: ttlSeconds }).catch(() => {})
      );
      c.header('X-Cache', 'MISS');
      c.header('Cache-Control', `public, max-age=${ttlSeconds}`);
    }
  };
}

/**
 * Sets Cache-Control headers for public, immutable content.
 * Use for leaderboards, published results, etc.
 */
export function cacheControl(maxAge: number, staleWhileRevalidate: number = 0): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();
    if (c.res.status === 200) {
      const swr = staleWhileRevalidate > 0 ? `, stale-while-revalidate=${staleWhileRevalidate}` : '';
      c.header('Cache-Control', `public, max-age=${maxAge}${swr}`);
    }
  };
}
