import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';
import { getAllowedOrigins } from '../lib/allowed-origin.js';

export const corsMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const origins = getAllowedOrigins(c.env);

  const handler = cors({
    origin: origins,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'If-None-Match'],
    exposeHeaders: ['ETag', 'X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
    maxAge: 86400,
  });

  return handler(c, next);
};
