import { Hono } from 'hono';
import { eq, and, desc, count, sql, like } from 'drizzle-orm';
import { createDbClient, workspaceInvites, workspaces, platformAdmins, users, auditEvents, hackathons } from '@devsage/db';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/platform-admin.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';

const INVITE_EXPIRY_DAYS = 14;

const admin = new Hono<AuthAppEnv>();

admin.use('*', authMiddleware, requirePlatformAdmin);

admin.post('/invites', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ email: string; workspaceId?: string }>();

  if (!body.email || typeof body.email !== 'string') {
    return errorResponse(c, 400, 'INVALID_EMAIL', 'Email is required');
  }

  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(c, 400, 'INVALID_EMAIL', 'Invalid email format');
  }

  if (!body.workspaceId) {
    return errorResponse(c, 400, 'MISSING_WORKSPACE', 'workspaceId is required');
  }

  const db = createDbClient(c.env.DB);

  const workspace = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, body.workspaceId))
    .get();

  if (!workspace) {
    return errorResponse(c, 404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  }

  const existing = await db
    .select({ id: workspaceInvites.id, status: workspaceInvites.status })
    .from(workspaceInvites)
    .where(and(
      eq(workspaceInvites.email, email),
      eq(workspaceInvites.status, 'pending'),
    ))
    .get();

  if (existing) {
    return errorResponse(c, 409, 'INVITE_ALREADY_PENDING', 'A pending invite already exists for this email');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const inviteCode = crypto.randomUUID();
  const id = crypto.randomUUID();

  await db.insert(workspaceInvites).values({
    id,
    email,
    code: inviteCode,
    workspace_id: body.workspaceId,
    status: 'pending',
    created_by: user.sub,
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
  });

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    eventType: 'platform.workspace_invite_created',
    entityType: 'workspace_invite',
    entityId: id,
    metadata: { email, workspaceId: body.workspaceId },
  });

  await c.env.NOTIFICATION_QUEUE.send({
    type: 'workspace_invite_created',
    inviteId: id,
    email,
    inviteCode,
  });

  return successResponse(c, {
    id,
    email,
    code: inviteCode,
    workspace_id: body.workspaceId,
    status: 'pending',
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
  }, undefined, 201);
});

admin.get('/invites', async (c) => {
  const db = createDbClient(c.env.DB);
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const offset = Number(c.req.query('offset') ?? 0);

  const data = await db
    .select({
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      code: workspaceInvites.code,
      workspace_id: workspaceInvites.workspace_id,
      status: workspaceInvites.status,
      created_by: workspaceInvites.created_by,
      accepted_by: workspaceInvites.accepted_by,
      accepted_at: workspaceInvites.accepted_at,
      expires_at: workspaceInvites.expires_at,
      created_at: workspaceInvites.created_at,
    })
    .from(workspaceInvites)
    .orderBy(desc(workspaceInvites.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({ value: count() })
    .from(workspaceInvites)
    .get();

  return paginatedResponse(c, data, totalResult?.value ?? 0, limit, offset);
});

admin.delete('/invites/:id', async (c) => {
  const inviteId = c.req.param('id');
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  const invite = await db
    .select()
    .from(workspaceInvites)
    .where(eq(workspaceInvites.id, inviteId))
    .get();

  if (!invite) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  }

  if (invite.status === 'accepted') {
    return errorResponse(c, 400, 'ALREADY_ACCEPTED', 'Cannot revoke an accepted invite');
  }

  await db
    .update(workspaceInvites)
    .set({ status: 'revoked' })
    .where(eq(workspaceInvites.id, inviteId));

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    eventType: 'platform.workspace_invite_revoked',
    entityType: 'workspace_invite',
    entityId: inviteId,
    metadata: { email: invite.email },
  });

  return successResponse(c, { message: 'Invite revoked' });
});

admin.get('/admins', async (c) => {
  const db = createDbClient(c.env.DB);

  const data = await db
    .select({
      id: platformAdmins.id,
      user_id: platformAdmins.user_id,
      role: platformAdmins.role,
      created_by: platformAdmins.created_by,
      created_at: platformAdmins.created_at,
      display_name: users.display_name,
      github_username: users.github_username,
      email: users.email,
      avatar_url: users.avatar_url,
    })
    .from(platformAdmins)
    .innerJoin(users, eq(platformAdmins.user_id, users.id))
    .all();

  return successResponse(c, data);
});

admin.post('/admins', async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  const caller = await db
    .select({ role: platformAdmins.role })
    .from(platformAdmins)
    .where(eq(platformAdmins.user_id, user.sub))
    .get();

  if (!caller || caller.role !== 'super_admin') {
    return errorResponse(c, 403, 'FORBIDDEN', 'Only super admins can add platform admins');
  }

  const body = await c.req.json<{ userId: string; role?: string }>();
  if (!body.userId) {
    return errorResponse(c, 400, 'MISSING_USER_ID', 'userId is required');
  }

  const targetUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, body.userId))
    .get();

  if (!targetUser) {
    return errorResponse(c, 404, 'USER_NOT_FOUND', 'User not found');
  }

  const existing = await db
    .select({ id: platformAdmins.id })
    .from(platformAdmins)
    .where(eq(platformAdmins.user_id, body.userId))
    .get();

  if (existing) {
    return errorResponse(c, 409, 'ALREADY_ADMIN', 'User is already a platform admin');
  }

  const id = crypto.randomUUID();
  const role = body.role === 'super_admin' ? 'super_admin' : 'platform_admin';

  await db.insert(platformAdmins).values({
    id,
    user_id: body.userId,
    role,
    created_by: user.sub,
    created_at: new Date().toISOString(),
  });

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    eventType: 'platform.admin_added',
    entityType: 'platform_admin',
    entityId: id,
    metadata: { userId: body.userId, role },
  });

  return successResponse(c, { id, user_id: body.userId, role }, undefined, 201);
});

admin.delete('/admins/:userId', async (c) => {
  const targetUserId = c.req.param('userId');
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  const caller = await db
    .select({ role: platformAdmins.role })
    .from(platformAdmins)
    .where(eq(platformAdmins.user_id, user.sub))
    .get();

  if (!caller || caller.role !== 'super_admin') {
    return errorResponse(c, 403, 'FORBIDDEN', 'Only super admins can remove platform admins');
  }

  if (targetUserId === user.sub) {
    return errorResponse(c, 400, 'CANNOT_REMOVE_SELF', 'Cannot remove yourself as admin');
  }

  const target = await db
    .select({ id: platformAdmins.id })
    .from(platformAdmins)
    .where(eq(platformAdmins.user_id, targetUserId))
    .get();

  if (!target) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Platform admin not found');
  }

  await db
    .delete(platformAdmins)
    .where(eq(platformAdmins.user_id, targetUserId));

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    eventType: 'platform.admin_removed',
    entityType: 'platform_admin',
    entityId: target.id,
    metadata: { userId: targetUserId },
  });

  return successResponse(c, { message: 'Platform admin removed' });
});

admin.get('/workspaces', async (c) => {
  const db = createDbClient(c.env.DB);
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const offset = Number(c.req.query('offset') ?? 0);

  const data = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      description: workspaces.description,
      logo_url: workspaces.logo_url,
      website: workspaces.website,
      created_by: workspaces.created_by,
      created_at: workspaces.created_at,
      updated_at: workspaces.updated_at,
    })
    .from(workspaces)
    .orderBy(desc(workspaces.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({ value: count() })
    .from(workspaces)
    .get();

  return paginatedResponse(c, data, totalResult?.value ?? 0, limit, offset);
});

/**
 * GET /health — system health check
 */
admin.get('/health', async (c) => {
  const db = createDbClient(c.env.DB);

  try {
    await db.select({ value: sql<number>`1` }).from(users).limit(1).get();
    return successResponse(c, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      db: 'connected',
    });
  } catch {
    return errorResponse(c, 503, 'UNHEALTHY', 'Database connection failed');
  }
});

/**
 * GET /users — list all users (paginated)
 */
admin.get('/users', async (c) => {
  const db = createDbClient(c.env.DB);
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const offset = Number(c.req.query('offset') ?? 0);
  const search = c.req.query('search');

  const conditions = search
    ? sql`${users.display_name} LIKE ${'%' + search + '%'} OR ${users.github_username} LIKE ${'%' + search + '%'}`
    : undefined;

  const data = await db
    .select({
      id: users.id,
      githubUsername: users.github_username,
      displayName: users.display_name,
      email: users.email,
      avatarUrl: users.avatar_url,
      createdAt: users.created_at,
      updatedAt: users.updated_at,
    })
    .from(users)
    .where(conditions)
    .orderBy(desc(users.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db.select({ value: count() }).from(users).where(conditions).get();
  return paginatedResponse(c, data, totalResult?.value ?? 0, limit, offset);
});

/**
 * GET /hackathons — list all hackathons (admin overview)
 */
admin.get('/hackathons', async (c) => {
  const db = createDbClient(c.env.DB);
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const offset = Number(c.req.query('offset') ?? 0);

  const data = await db
    .select()
    .from(hackathons)
    .orderBy(desc(hackathons.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db.select({ value: count() }).from(hackathons).get();
  return paginatedResponse(c, data, totalResult?.value ?? 0, limit, offset);
});

/**
 * DELETE /hackathons/:id — force-delete a hackathon (super admin only)
 */
admin.delete('/hackathons/:id', async (c) => {
  const hackathonId = c.req.param('id');
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  const hackathon = await db
    .select()
    .from(hackathons)
    .where(eq(hackathons.id, hackathonId))
    .get();

  if (!hackathon) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Hackathon not found');
  }

  await db.delete(hackathons).where(eq(hackathons.id, hackathonId));

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    eventType: 'platform.hackathon_force_delete',
    entityType: 'hackathon',
    entityId: hackathonId,
    metadata: { title: hackathon.title, slug: hackathon.slug },
  });

  return successResponse(c, { deleted: true });
});

/**
 * GET /audit — platform-wide audit trail
 */
admin.get('/audit', async (c) => {
  const db = createDbClient(c.env.DB);
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const offset = Number(c.req.query('offset') ?? 0);
  const eventTypeFilter = c.req.query('event_type');

  let whereClause;
  if (eventTypeFilter) {
    whereClause = eq(auditEvents.event_type, eventTypeFilter);
  }

  const data = await db
    .select()
    .from(auditEvents)
    .where(whereClause)
    .orderBy(desc(auditEvents.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db.select({ value: count() }).from(auditEvents).where(whereClause).get();
  return paginatedResponse(c, data, totalResult?.value ?? 0, limit, offset);
});

/**
 * GET /audit/dashboard/recent — recent audit events for admin dashboard
 */
admin.get('/audit/dashboard/recent', async (c) => {
  const db = createDbClient(c.env.DB);
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);

  const data = await db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.created_at))
    .limit(limit)
    .all();

  return successResponse(c, data);
});

/**
 * GET /audit/dashboard/stats — aggregate audit statistics
 */
admin.get('/audit/dashboard/stats', async (c) => {
  const db = createDbClient(c.env.DB);

  const totalEvents = await db.select({ value: count() }).from(auditEvents).get();
  const totalUsers = await db.select({ value: count() }).from(users).get();
  const totalHackathons = await db.select({ value: count() }).from(hackathons).get();
  const totalWorkspaces = await db.select({ value: count() }).from(workspaces).get();

  return successResponse(c, {
    totalEvents: totalEvents?.value ?? 0,
    totalUsers: totalUsers?.value ?? 0,
    totalHackathons: totalHackathons?.value ?? 0,
    totalWorkspaces: totalWorkspaces?.value ?? 0,
  });
});

export default admin;
