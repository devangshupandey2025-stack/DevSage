import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';
import { getAllowedOrigins } from '../lib/allowed-origin.js';

export const corsMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const originMatcher = getAllowedOrigins(c.env);

  const handler = cors({
    // originMatcher is a function (origin: string) => boolean
    // Hono's cors() accepts a function that receives the origin and returns
    // the origin string if allowed, or null/empty to deny.
    origin: (origin) => {
      if (typeof originMatcher === 'function') {
        return originMatcher(origin) ? origin : '';
      }
      return '';
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'If-None-Match'],
    exposeHeaders: ['ETag', 'X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
    maxAge: 86400,
  });

  return handler(c, next);
};
