import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env.js';

function isAllowedCorsOrigin(origin: string, frontendUrl: string): boolean {
  if (origin === frontendUrl) {
    return true;
  }

  if (origin === 'http://localhost:5173') {
    return true;
  }

  return false;
}

/**
 * CORS middleware for cross-origin requests.
 * Allows the configured FRONTEND_URL and localhost dev server.
 * Handles OPTIONS preflight with a 204 response.
 */
export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin && isAllowedCorsOrigin(origin, c.env.FRONTEND_URL)) {
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
