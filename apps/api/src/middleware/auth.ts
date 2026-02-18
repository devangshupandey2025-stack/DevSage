import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from '../types/env.js';
import { verifyJWT } from '../lib/jwt.js';

/**
 * Global middleware: extracts and validates JWT from HttpOnly cookie.
 * Sets c.set('user', ...) on success, c.set('user', null) on failure.
 * Never rejects — downstream handlers check user themselves.
 */
export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, 'access_token');

  if (!token) {
    c.set('user', null);
    return next();
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    c.set('user', null);
    return next();
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?'
  ).bind(payload.sub).first<{
    id: string; email: string; name: string; avatar_url: string | null; created_at: string;
  }>();

  if (!user) {
    c.set('user', null);
    return next();
  }

  c.set('user', user);
  return next();
};

/**
 * Per-route middleware: requires authenticated user.
 * Returns 401 if no valid session.
 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
      401
    );
  }
  return next();
};
