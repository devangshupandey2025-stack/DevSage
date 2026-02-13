import type { MiddlewareHandler } from 'hono';
import { eq, and } from 'drizzle-orm';
import { createDbClient, platformAdmins, organizerInvites } from '@devsage/db';
import { errorResponse } from '../lib/response.js';
import type { AuthAppEnv } from '../types/auth.js';

export const requireOrganizer: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return errorResponse(c, 401, 'NO_TOKEN', 'Authentication required');
  }

  const db = createDbClient(c.env.DB);

  const [admin, invite] = await Promise.all([
    db
      .select({ id: platformAdmins.id })
      .from(platformAdmins)
      .where(eq(platformAdmins.user_id, user.sub))
      .get(),
    db
      .select({ id: organizerInvites.id })
      .from(organizerInvites)
      .where(
        and(
          eq(organizerInvites.accepted_by, user.sub),
          eq(organizerInvites.status, 'accepted'),
        ),
      )
      .get(),
  ]);

  if (!admin && !invite) {
    return errorResponse(c, 403, 'NOT_ORGANIZER', 'Organizer access required. You need an accepted invite from a platform admin.');
  }

  await next();
};
