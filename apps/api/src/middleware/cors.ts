import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env.js';

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];

function getAllowedOrigins(env: Env): string[] {
  return [
    env.FRONTEND_URL,
    env.PLATFORM_URL,
    env.ADMIN_URL,
    ...DEV_ORIGINS,
  ].filter(Boolean);
}

export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin && getAllowedOrigins(c.env).includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
    c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    c.header('Vary', 'Origin');
  }

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
};
