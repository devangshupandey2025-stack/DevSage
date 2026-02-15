import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { createDbClient, workspaceInvites, workspaceMembers, users } from '@devsage/db';
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
      id: workspaceInvites.id,
      email: workspaceInvites.email,
      workspace_id: workspaceInvites.workspace_id,
      status: workspaceInvites.status,
      expires_at: workspaceInvites.expires_at,
    })
    .from(workspaceInvites)
    .where(eq(workspaceInvites.code, code))
    .get();

  if (!invite) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  }

  const now = new Date();
  const expired = new Date(invite.expires_at) < now;

  return successResponse(c, {
    id: invite.id,
    email: invite.email,
    workspace_id: invite.workspace_id,
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
    .from(workspaceInvites)
    .where(eq(workspaceInvites.code, code))
    .get();

  if (!invite) {
    return errorResponse(c, 404, 'INVITE_NOT_FOUND', 'Invite not found');
  }

  if (invite.status === 'accepted') {
    return errorResponse(c, 409, 'INVITE_ALREADY_ACCEPTED', 'This invite has already been accepted');
  }

  if (invite.status !== 'pending') {
    return errorResponse(c, 400, 'INVITE_NOT_PENDING', 'Invite is no longer pending');
  }

  const now = new Date();
  if (new Date(invite.expires_at) < now) {
    await db
      .update(workspaceInvites)
      .set({ status: 'expired' })
      .where(eq(workspaceInvites.id, invite.id));
    return errorResponse(c, 410, 'INVITE_EXPIRED', 'This invite has expired');
  }

  const userRecord = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, user.sub))
    .get();

  if (invite.email && userRecord?.email && invite.email.toLowerCase() !== userRecord.email.toLowerCase()) {
    return errorResponse(c, 403, 'INVITE_EMAIL_MISMATCH', 'Your email does not match the invite email');
  }

  await db
    .update(workspaceInvites)
    .set({
      status: 'accepted',
      accepted_by: user.sub,
      accepted_at: now.toISOString(),
    })
    .where(eq(workspaceInvites.id, invite.id));

  await db.insert(workspaceMembers).values({
    id: crypto.randomUUID(),
    workspace_id: invite.workspace_id,
    user_id: user.sub,
    role: 'workspace_member',
    invited_by: invite.created_by,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    action: 'workspace.invite_accepted',
    entityType: 'workspace_invite',
    entityId: invite.id,
    details: { email: invite.email, workspace_id: invite.workspace_id, invite_code: code },
  });

  return successResponse(c, { message: 'Invite accepted. You are now a workspace member.' });
});

export default invites;
