import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from '../types/env.js';

/**
 * Global middleware: resolves Better Auth session from cookie.
 * Reads the `better-auth.session_token` cookie, looks up the session
 * in the BA `session` table, and populates `c.set('user', ...)` from
 * the legacy `users` table.
 * Never rejects — downstream handlers check user themselves.
 */
export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    const token = getCookie(c, 'better-auth.session_token');
    if (!token) {
      c.set('user', null);
      return next();
    }

    // Look up BA session directly
    const session = await c.env.DB.prepare(
      'SELECT userId, expiresAt FROM session WHERE token = ?'
    ).bind(token).first<{ userId: string; expiresAt: number }>();

    if (!session || session.expiresAt < Math.floor(Date.now() / 1000)) {
      c.set('user', null);
      return next();
    }

    // Look up the legacy users row to populate the same UserContext shape
    const user = await c.env.DB.prepare(
      'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?'
    ).bind(session.userId).first<{
      id: string; email: string; name: string; avatar_url: string | null; created_at: string;
    }>();

    if (!user) {
      c.set('user', null);
      return next();
    }

    c.set('user', { ...user, github_username: '' });
  } catch {
    c.set('user', null);
  }

  return next();
};

/**
 * Per-route middleware: requires authenticated user.
 * Returns 401 if no valid session.
 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  // Safety net: if optionalAuth hasn't run yet, resolve session inline
  let user = c.get('user');
  if (user === undefined) {
    try {
      const token = getCookie(c, 'better-auth.session_token');
      if (token) {
        const session = await c.env.DB.prepare(
          'SELECT userId, expiresAt FROM session WHERE token = ?'
        ).bind(token).first<{ userId: string; expiresAt: number }>();

        if (session && session.expiresAt >= Math.floor(Date.now() / 1000)) {
          const row = await c.env.DB.prepare(
            'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?'
          ).bind(session.userId).first<{
            id: string; email: string; name: string; avatar_url: string | null; created_at: string;
          }>();
          if (row) {
            c.set('user', { ...row, github_username: '' });
            user = c.get('user');
          }
        }
      }
    } catch {
      // fall through to 401
    }
  }

  if (!user) {
    return c.json(
      { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
      401
    );
  }
  return next();
};
