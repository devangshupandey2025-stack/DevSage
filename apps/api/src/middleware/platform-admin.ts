import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';

export const requirePlatformAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  // Dev bypass: skip admin check
  if (c.env.DEV_AUTH_BYPASS) {
    return next();
  }

  const user = c.get('user');
  if (!user) {
    return c.json(
      { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
      401
    );
  }

  const admin = await c.env.DB.prepare(
    'SELECT id FROM platform_admins WHERE user_id = ?'
  ).bind(user.id).first();

  if (!admin) {
    return c.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Platform admin access required' } },
      403
    );
  }

  return next();
};
