import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { createDbClient, organizerRoles, users } from '@devsage/db';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { successResponse, errorResponse } from '../lib/response.js';

const organizersRouter = new Hono<AuthAppEnv>();

organizersRouter.get(
  '/:slug/organizers',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const db = createDbClient(c.env.DB);

    const data = await db
      .select({
        id: organizerRoles.id,
        hackathon_id: organizerRoles.hackathon_id,
        user_id: organizerRoles.user_id,
        role: organizerRoles.role,
        created_at: organizerRoles.created_at,
        display_name: users.display_name,
        email: users.email,
        avatar_url: users.avatar_url,
      })
      .from(organizerRoles)
      .innerJoin(users, eq(users.id, organizerRoles.user_id))
      .where(eq(organizerRoles.hackathon_id, hackathon.id))
      .all();

    return successResponse(c, data);
  },
);

organizersRouter.post(
  '/:slug/organizers',
  authMiddleware,
  requireRole('organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const db = createDbClient(c.env.DB);
    const body = await c.req.json<{ user_id: string; role: string }>();

    if (body.role !== 'co_organizer') {
      return errorResponse(c, 400, 'INVALID_ROLE', 'Can only add co_organizer role. Use transfer-ownership for organizer role.');
    }

    const targetUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, body.user_id))
      .get();

    if (!targetUser) {
      return errorResponse(c, 404, 'USER_NOT_FOUND', 'Target user not found');
    }

    const existing = await db
      .select({ id: organizerRoles.id })
      .from(organizerRoles)
      .where(and(eq(organizerRoles.hackathon_id, hackathon.id), eq(organizerRoles.user_id, body.user_id)))
      .get();

    if (existing) {
      return errorResponse(c, 409, 'ALREADY_ORGANIZER', 'User already has an organizer role for this hackathon');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(organizerRoles).values({
      id,
      hackathon_id: hackathon.id,
      user_id: body.user_id,
      role: 'co_organizer',
      created_at: now,
      updated_at: now,
    });

    const created = await db
      .select()
      .from(organizerRoles)
      .where(eq(organizerRoles.id, id))
      .get();

    return successResponse(c, created, undefined, 201);
  },
);

organizersRouter.put(
  '/:slug/organizers/:userId',
  authMiddleware,
  requireRole('organizer'),
  async (c) => {
    const user = c.get('user');
    const hackathon = c.get('hackathon');
    const targetUserId = c.req.param('userId');
    const db = createDbClient(c.env.DB);
    const body = await c.req.json<{ role: string }>();

    if (body.role !== 'co_organizer') {
      return errorResponse(c, 400, 'INVALID_ROLE', 'Can only set co_organizer role. Use transfer-ownership for organizer role.');
    }

    if (targetUserId === user.sub) {
      return errorResponse(c, 400, 'CANNOT_MODIFY_SELF', 'Cannot modify your own role. Use transfer-ownership.');
    }

    const existing = await db
      .select({ id: organizerRoles.id, role: organizerRoles.role })
      .from(organizerRoles)
      .where(and(eq(organizerRoles.hackathon_id, hackathon.id), eq(organizerRoles.user_id, targetUserId)))
      .get();

    if (!existing) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Organizer role not found for this user');
    }

    await db
      .update(organizerRoles)
      .set({ role: 'co_organizer' })
      .where(eq(organizerRoles.id, existing.id));

    const updated = await db
      .select()
      .from(organizerRoles)
      .where(eq(organizerRoles.id, existing.id))
      .get();

    return successResponse(c, updated);
  },
);

organizersRouter.delete(
  '/:slug/organizers/:userId',
  authMiddleware,
  requireRole('organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const targetUserId = c.req.param('userId');
    const db = createDbClient(c.env.DB);

    const existing = await db
      .select({ id: organizerRoles.id, role: organizerRoles.role })
      .from(organizerRoles)
      .where(and(eq(organizerRoles.hackathon_id, hackathon.id), eq(organizerRoles.user_id, targetUserId)))
      .get();

    if (!existing) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Organizer role not found for this user');
    }

    if (existing.role === 'organizer') {
      return errorResponse(c, 400, 'CANNOT_REMOVE_OWNER', 'Cannot remove the organizer. Use transfer-ownership.');
    }

    await db
      .delete(organizerRoles)
      .where(eq(organizerRoles.id, existing.id));

    return successResponse(c, { removed: true });
  },
);

export default organizersRouter;
