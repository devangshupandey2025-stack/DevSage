import type { MiddlewareHandler } from 'hono';
import { getSessionCookie } from '../lib/cookies.js';
import { verifyJWT } from '../lib/jwt.js';
import type { AuthAppEnv } from '../types/auth.js';

export const authMiddleware: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const token = getSessionCookie(c);
  if (!token) {
    return c.json({ error: 'Unauthorized', code: 'NO_TOKEN' }, 401);
  }

  const user = await verifyJWT(token, c.env.JWT_SECRET);
  if (!user) {
    return c.json({ error: 'Invalid token', code: 'INVALID_TOKEN' }, 401);
  }

  c.set('user', user);
  await next();
};
