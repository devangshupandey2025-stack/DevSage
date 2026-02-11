import type { MiddlewareHandler } from 'hono';
import { getSessionCookie } from '../lib/cookies.js';
import { verifyJWT } from '../lib/jwt.js';
import type { AuthAppEnv } from '../types/auth.js';

export const authMiddleware: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const token = getSessionCookie(c);
  if (!token) {
    return c.json({ ok: false, error: { code: 'NO_TOKEN', message: 'Unauthorized' } }, 401);
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ ok: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } }, 401);
  }

  c.set('user', { sub: payload.sub, ghid: payload.ghid, ghu: payload.ghu });
  await next();
};

export const optionalAuth: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const token = getSessionCookie(c);
  if (token) {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (payload) {
      c.set('user', { sub: payload.sub, ghid: payload.ghid, ghu: payload.ghu });
    }
  }
  await next();
};
