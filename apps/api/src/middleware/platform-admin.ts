import type { MiddlewareHandler } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient, platformAdmins } from '@devsage/db';
import { errorResponse } from '../lib/response.js';
import type { AuthAppEnv } from '../types/auth.js';

/**
 * Middleware that verifies the authenticated user is a platform admin.
 * Must be used AFTER `authMiddleware` in the middleware chain.
 *
 * Checks the `platform_admins` table for the user's ID.
 * Returns 403 if the user is not a platform admin.
 */
export const requirePlatformAdmin: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return errorResponse(c, 401, 'NO_TOKEN', 'Authentication required');
  }

  const db = createDbClient(c.env.DB);
  const admin = await db
    .select({ id: platformAdmins.id })
    .from(platformAdmins)
    .where(eq(platformAdmins.user_id, user.sub))
    .get();

  if (!admin) {
    return errorResponse(c, 403, 'NOT_PLATFORM_ADMIN', 'Platform admin access required');
  }

  await next();
};
