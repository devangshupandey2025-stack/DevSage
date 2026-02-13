import { Hono } from 'hono';
import { eq, desc, count } from 'drizzle-orm';
import { createDbClient, organizerInvites, platformAdmins, users } from '@devsage/db';
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
  const body = await c.req.json<{ email: string }>();

  if (!body.email || typeof body.email !== 'string') {
    return errorResponse(c, 400, 'INVALID_EMAIL', 'Email is required');
  }

  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(c, 400, 'INVALID_EMAIL', 'Invalid email format');
  }

  const db = createDbClient(c.env.DB);

  const existing = await db
    .select({ id: organizerInvites.id })
    .from(organizerInvites)
    .where(eq(organizerInvites.email, email))
    .get();

  if (existing) {
    return errorResponse(c, 409, 'INVITE_EXISTS', 'An invite for this email already exists');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const inviteCode = crypto.randomUUID();
  const id = crypto.randomUUID();

  await db.insert(organizerInvites).values({
    id,
    email,
    invite_code: inviteCode,
    status: 'pending',
    invited_by: user.sub,
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
  });

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    action: 'organizer_invite.create',
    entityType: 'organizer_invite',
    entityId: id,
    details: { email },
  });

  await c.env.NOTIFICATION_QUEUE.send({
    type: 'organizer_invited',
    inviteId: id,
    email,
    inviteCode,
  });

  return successResponse(c, {
    id,
    email,
    invite_code: inviteCode,
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
      id: organizerInvites.id,
      email: organizerInvites.email,
      invite_code: organizerInvites.invite_code,
      status: organizerInvites.status,
      invited_by: organizerInvites.invited_by,
      accepted_by: organizerInvites.accepted_by,
      accepted_at: organizerInvites.accepted_at,
      expires_at: organizerInvites.expires_at,
      created_at: organizerInvites.created_at,
    })
    .from(organizerInvites)
    .orderBy(desc(organizerInvites.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({ value: count() })
    .from(organizerInvites)
    .get();

  return paginatedResponse(c, data, totalResult?.value ?? 0, limit, offset);
});

admin.delete('/invites/:id', async (c) => {
  const inviteId = c.req.param('id');
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  const invite = await db
    .select()
    .from(organizerInvites)
    .where(eq(organizerInvites.id, inviteId))
    .get();

  if (!invite) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  }

  if (invite.status === 'accepted') {
    return errorResponse(c, 400, 'ALREADY_ACCEPTED', 'Cannot revoke an accepted invite');
  }

  await db
    .update(organizerInvites)
    .set({ status: 'revoked' })
    .where(eq(organizerInvites.id, inviteId));

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    action: 'organizer_invite.revoke',
    entityType: 'organizer_invite',
    entityId: inviteId,
    details: { email: invite.email },
  });

  return successResponse(c, { message: 'Invite revoked' });
});

admin.get('/admins', async (c) => {
  const db = createDbClient(c.env.DB);

  const data = await db
    .select({
      id: platformAdmins.id,
      user_id: platformAdmins.user_id,
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

export default admin;
