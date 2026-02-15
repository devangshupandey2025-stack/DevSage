import type { MiddlewareHandler } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient, users } from '@devsage/db';
import { getAccessTokenCookie } from '../lib/cookies.js';
import { verifyJWT } from '../lib/jwt.js';
import type { JWTPayload } from '../lib/jwt.js';
import { errorResponse } from '../lib/response.js';
import type { AuthAppEnv } from '../types/auth.js';

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as Partial<JWTPayload>;
    if (typeof payload.exp === 'number') {
      return payload.exp <= Math.floor(Date.now() / 1000);
    }
    return false;
  } catch {
    return false;
  }
}

export const authMiddleware: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const token = getAccessTokenCookie(c);
  if (!token) {
    return errorResponse(c, 401, 'NO_TOKEN', 'Authentication required. Please sign in.');
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    if (isTokenExpired(token)) {
      return errorResponse(c, 401, 'TOKEN_EXPIRED', 'Session expired.');
    }
    return errorResponse(c, 401, 'INVALID_TOKEN', 'Invalid session. Please sign in again.');
  }

  const db = createDbClient(c.env.DB);
  const row = await db
    .select({ suspended: users.suspended })
    .from(users)
    .where(eq(users.id, payload.sub))
    .get();

  if (row?.suspended === 1) {
    return errorResponse(c, 403, 'USER_SUSPENDED', 'Your account has been suspended.');
  }

  c.set('user', { sub: payload.sub, ghid: payload.ghid, ghu: payload.ghu, fam: payload.fam });
  await next();
};

export const optionalAuth: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const token = getAccessTokenCookie(c);
  if (token) {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (payload) {
      c.set('user', { sub: payload.sub, ghid: payload.ghid, ghu: payload.ghu, fam: payload.fam });
    }
  }
  await next();
};
