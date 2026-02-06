import type { MiddlewareHandler } from 'hono';
import type { UserRole } from '../lib/jwt.js';
import type { AuthAppEnv } from '../types/auth.js';

export const requireRole = (role: UserRole): MiddlewareHandler<AuthAppEnv> => {
  return async (c, next) => {
    const user = c.get('user');
    if (user.role !== role) {
      return c.json({ error: 'Forbidden', code: 'INSUFFICIENT_ROLE' }, 403);
    }

    await next();
  };
};
