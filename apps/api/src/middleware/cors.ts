import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env.js';
import { isAllowedOrigin } from '../lib/allowed-origin.js';

export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin && isAllowedOrigin(origin, {
    frontendUrl: c.env.FRONTEND_URL,
    platformUrl: c.env.PLATFORM_URL,
    adminUrl: c.env.ADMIN_URL,
  })) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, Last-Event-ID');
    c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    c.header('Access-Control-Expose-Headers', 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, ETag');
    c.header('Access-Control-Max-Age', '86400');
    c.header('Vary', 'Origin');
  }

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
};
