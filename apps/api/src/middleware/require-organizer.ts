import type { MiddlewareHandler } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient, platformAdmins, workspaceMembers } from '@devsage/db';
import { errorResponse } from '../lib/response.js';
import type { AuthAppEnv } from '../types/auth.js';

export const requireOrganizer: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return errorResponse(c, 401, 'NO_TOKEN', 'Authentication required');
  }

  const db = createDbClient(c.env.DB);

  const [admin, membership] = await Promise.all([
    db
      .select({ id: platformAdmins.id })
      .from(platformAdmins)
      .where(eq(platformAdmins.user_id, user.sub))
      .get(),
    db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.user_id, user.sub))
      .get(),
  ]);

  if (!admin && !membership) {
    return errorResponse(c, 403, 'NOT_ORGANIZER', 'Organizer access required. You need workspace membership.');
  }

  await next();
};
