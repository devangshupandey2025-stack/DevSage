import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';

export const requirePlatformAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
      401
    );
  }

  if (!user.platformAdmin) {
    return c.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Platform admin required' } },
      403
    );
  }

  return next();
};
