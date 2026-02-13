import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { createDbClient, organizerInvites } from '@devsage/db';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';

const invites = new Hono<AuthAppEnv>();

invites.get('/:code', async (c) => {
  const code = c.req.param('code');
  const db = createDbClient(c.env.DB);

  const invite = await db
    .select({
      id: organizerInvites.id,
      email: organizerInvites.email,
      status: organizerInvites.status,
      expires_at: organizerInvites.expires_at,
    })
    .from(organizerInvites)
    .where(eq(organizerInvites.invite_code, code))
    .get();

  if (!invite) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  }

  const now = new Date();
  const expired = new Date(invite.expires_at) < now;

  return successResponse(c, {
    id: invite.id,
    email: invite.email,
    status: expired && invite.status === 'pending' ? 'expired' : invite.status,
    expires_at: invite.expires_at,
  });
});

invites.post('/:code/accept', authMiddleware, async (c) => {
  const code = c.req.param('code');
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  const invite = await db
    .select()
    .from(organizerInvites)
    .where(
      and(
        eq(organizerInvites.invite_code, code),
        eq(organizerInvites.status, 'pending'),
      ),
    )
    .get();

  if (!invite) {
    return errorResponse(c, 404, 'INVITE_NOT_FOUND', 'Invite not found or already used');
  }

  const now = new Date();
  if (new Date(invite.expires_at) < now) {
    await db
      .update(organizerInvites)
      .set({ status: 'expired' })
      .where(eq(organizerInvites.id, invite.id));
    return errorResponse(c, 410, 'INVITE_EXPIRED', 'This invite has expired');
  }

  await db
    .update(organizerInvites)
    .set({
      status: 'accepted',
      accepted_by: user.sub,
      accepted_at: now.toISOString(),
    })
    .where(eq(organizerInvites.id, invite.id));

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    action: 'organizer_invite.accept',
    entityType: 'organizer_invite',
    entityId: invite.id,
    details: { email: invite.email, invite_code: code },
  });

  return successResponse(c, { message: 'Invite accepted. You now have organizer access.' });
});

export default invites;
