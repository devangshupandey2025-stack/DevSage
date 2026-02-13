import type { MiddlewareHandler } from 'hono';
import { getSessionCookie } from '../lib/cookies.js';
import { verifyJWT } from '../lib/jwt.js';
import { errorResponse } from '../lib/response.js';
import type { AuthAppEnv } from '../types/auth.js';

export const authMiddleware: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const token = getSessionCookie(c);
  if (!token) {
    return errorResponse(c, 401, 'NO_TOKEN', 'Unauthorized');
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return errorResponse(c, 401, 'INVALID_TOKEN', 'Invalid or expired token');
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
