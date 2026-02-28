import { Hono, type Context } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import { createWorkspaceSchema, updateWorkspaceSchema, inviteWorkspaceMemberSchema } from '@devsage/shared';
import { z } from 'zod';

// Extend shared schema to accept any workspace type string (DB doesn't restrict)
const createWorkspaceBodySchema = createWorkspaceSchema.extend({
  type: z.string().min(1),
});

const workspaces = new Hono<AppEnv>();

async function getWorkspaceRole(c: Context<AppEnv>, workspaceId: string, userId: string): Promise<string | null> {
  const membership = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1',
  ).bind(workspaceId, userId).first<{ role: string }>();
  return membership?.role ?? null;
}

// Create workspace (any authenticated user)
workspaces.post('/', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = await validateBody(c, createWorkspaceBodySchema);
  if (body instanceof Response) return body;

  const existing = await c.env.DB.prepare('SELECT id FROM workspaces WHERE slug = ?').bind(body.slug).first();
  if (existing) return errorResponse(c, 409, 'SLUG_TAKEN', 'Slug already in use');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO workspaces (id, name, slug, description, type, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.name, body.slug, body.description ?? '', body.type, user.id, now, now).run();

  // Add creator as owner
  await c.env.DB.prepare(
    'INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), id, user.id, 'owner', now).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id, actor_type: 'user',
      action: 'workspace.created', entity_type: 'workspace', entity_id: id,
      details: { name: body.name },
    })
  );

  const created = await c.env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(id).first();
  return successResponse(c, created, { status: 201 });
});

// List user's workspaces
workspaces.get('/', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const rows = await c.env.DB.prepare(`
    SELECT w.*, wm.role as member_role
    FROM workspaces w
    JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = ?
    ORDER BY w.created_at DESC
  `).bind(user.id).all();
  return successResponse(c, rows.results || []);
});

// Get workspace (supports both id and slug)
workspaces.get('/:workspaceId', authMiddleware, async (c) => {
  const workspaceId = c.req.param('workspaceId');
  const workspace = await c.env.DB.prepare(
    'SELECT * FROM workspaces WHERE id = ? OR slug = ?'
  ).bind(workspaceId, workspaceId).first();
  if (!workspace) return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');

  // Include members and hackathons
  const [members, hackathons] = await Promise.all([
    c.env.DB.prepare(`
      SELECT wm.id, wm.user_id, wm.role, wm.created_at,
             u.name, u.email, u.avatar_url
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
      ORDER BY wm.created_at ASC
    `).bind((workspace as { id: string }).id).all(),
    c.env.DB.prepare(`
      SELECT id, slug, title, status, created_at
      FROM hackathons WHERE workspace_id = ?
      ORDER BY created_at DESC
    `).bind((workspace as { id: string }).id).all(),
  ]);

  return successResponse(c, {
    ...workspace,
    members: members.results || [],
    hackathons: hackathons.results || [],
  });
});

// Update workspace
workspaces.patch('/:workspaceId', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const workspaceId = c.req.param('workspaceId');

  const workspaceRole = await getWorkspaceRole(c, workspaceId, user.id);

  if (!workspaceRole || !['owner', 'admin'].includes(workspaceRole)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Must be owner or admin');
  }

  const body = await validateBody(c, updateWorkspaceSchema);
  if (body instanceof Response) return body;
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const [field, value] of Object.entries(body)) {
    if (value !== undefined) { updates.push(`${field} = ?`); values.push(value); }
  }
  if (updates.length === 0) return errorResponse(c, 400, 'VALIDATION_ERROR', 'No fields to update');

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(workspaceId);

  await c.env.DB.prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  const updated = await c.env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(workspaceId).first();
  return successResponse(c, updated);
});

// List workspace members
workspaces.get('/:workspaceId/members', authMiddleware, async (c) => {
  const workspaceId = c.req.param('workspaceId');
  const members = await c.env.DB.prepare(`
    SELECT wm.id, wm.user_id, wm.role, wm.created_at,
           u.name, u.email, u.avatar_url as image
    FROM workspace_members wm
    JOIN users u ON wm.user_id = u.id
    WHERE wm.workspace_id = ?
    ORDER BY wm.created_at ASC
  `).bind(workspaceId).all();
  return successResponse(c, members.results || []);
});

// Invite workspace member
workspaces.post('/:workspaceId/invites', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const workspaceId = c.req.param('workspaceId');

  const workspaceRole = await getWorkspaceRole(c, workspaceId, user.id);

  if (!workspaceRole || !['owner', 'admin'].includes(workspaceRole)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Must be owner or admin');
  }

  const body = await validateBody(c, inviteWorkspaceMemberSchema);
  if (body instanceof Response) return body;

  const id = crypto.randomUUID();
  const inviteToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    `INSERT INTO workspace_invites (id, workspace_id, email, role, invite_token, invited_by, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, workspaceId, body.email, body.role, inviteToken, user.id, 'pending', expiresAt).run();

  // Send invite email
  const { sendEmail } = await import('../services/email.js');
  const workspace = await c.env.DB.prepare('SELECT name FROM workspaces WHERE id = ?').bind(workspaceId).first<{ name: string }>();
  const platformUrl = c.env.PLATFORM_URL || 'https://platform.devsage.org';
  const inviteLink = `${platformUrl}/invite/workspace/${inviteToken}`;

  c.executionCtx.waitUntil(
    sendEmail(c.env, {
      to: body.email,
      subject: `You've been invited to ${workspace?.name || 'a workspace'} on DevSage`,
      html: `
        <h2>Workspace Invitation</h2>
        <p>You've been invited as a <strong>${body.role}</strong> of <strong>${workspace?.name || 'a workspace'}</strong> on DevSage.</p>
        <p><a href="${inviteLink}" style="display:inline-block;padding:12px 24px;background:#CCFF00;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;">Accept Invitation</a></p>
        <p>This invite expires in 7 days.</p>
      `,
    })
  );

  return successResponse(c, { id, invite_token: inviteToken }, { status: 201 });
});

// Remove workspace member
workspaces.delete('/:workspaceId/members/:userId', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const workspaceId = c.req.param('workspaceId');
  const targetId = c.req.param('userId');

  const workspaceRole = await getWorkspaceRole(c, workspaceId, user.id);

  if (!workspaceRole || workspaceRole !== 'owner') {
    return errorResponse(c, 403, 'FORBIDDEN', 'Only owner can remove members');
  }

  if (targetId === user.id) {
    return errorResponse(c, 409, 'CANNOT_REMOVE_SELF', 'Cannot remove yourself');
  }

  await c.env.DB.prepare(
    'DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
  ).bind(workspaceId, targetId).run();

  return successResponse(c, { removed: true });
});

// ─── Workspace Invite Acceptance ─────────────────────────────

// Get workspace invite details by token
workspaces.get('/invites/token/:token', async (c) => {
  const token = c.req.param('token');

  const invite = await c.env.DB.prepare(`
    SELECT wi.id, wi.workspace_id, wi.email, wi.role, wi.status, wi.expires_at,
           w.name as workspace_name, w.slug as workspace_slug,
           u.name as inviter_name
    FROM workspace_invites wi
    JOIN workspaces w ON wi.workspace_id = w.id
    LEFT JOIN users u ON wi.invited_by = u.id
    WHERE wi.invite_token = ?
  `).bind(token).first<{
    id: string; workspace_id: string; email: string; role: string;
    status: string; expires_at: string;
    workspace_name: string; workspace_slug: string; inviter_name: string | null;
  }>();

  if (!invite) return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  if (invite.status !== 'pending') return errorResponse(c, 409, 'INVITE_USED', 'Invite already responded');
  if (new Date(invite.expires_at) < new Date()) return errorResponse(c, 410, 'INVITE_EXPIRED', 'Invite has expired');

  return successResponse(c, invite);
});

// Accept workspace invite
workspaces.post('/invites/token/:token/accept', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const token = c.req.param('token');

  const invite = await c.env.DB.prepare(`
    SELECT wi.id, wi.workspace_id, wi.email, wi.role, wi.status, wi.expires_at
    FROM workspace_invites wi
    WHERE wi.invite_token = ?
  `).bind(token).first<{
    id: string; workspace_id: string; email: string; role: string;
    status: string; expires_at: string;
  }>();

  if (!invite) return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  if (invite.status !== 'pending') return errorResponse(c, 409, 'INVITE_USED', 'Invite already responded');
  if (new Date(invite.expires_at) < new Date()) return errorResponse(c, 410, 'INVITE_EXPIRED', 'Invite has expired');

  // Check user email matches invite email
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return errorResponse(c, 403, 'EMAIL_MISMATCH', 'Your account email does not match the invite email');
  }

  // Check if already a member
  const existingMember = await c.env.DB.prepare(
    'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
  ).bind(invite.workspace_id, user.id).first();

  if (existingMember) return errorResponse(c, 409, 'ALREADY_MEMBER', 'You are already a member of this workspace');

  // Check owner limit (max 2 owners)
  if (invite.role === 'owner') {
    const ownerCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = ? AND role = 'owner'"
    ).bind(invite.workspace_id).first<{ count: number }>();
    if ((ownerCount?.count ?? 0) >= 2) {
      return errorResponse(c, 409, 'OWNER_LIMIT', 'Maximum 2 owners per workspace');
    }
  }

  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE workspace_invites SET status = 'accepted' WHERE id = ?"
    ).bind(invite.id),
    c.env.DB.prepare(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role, invited_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), invite.workspace_id, user.id, invite.role, null, now),
  ]);

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id, actor_type: 'user',
      action: 'workspace.invite_accepted', entity_type: 'workspace', entity_id: invite.workspace_id,
      details: { role: invite.role },
    })
  );

  return successResponse(c, { accepted: true, workspace_id: invite.workspace_id, role: invite.role });
});

// Decline workspace invite
workspaces.post('/invites/token/:token/decline', authMiddleware, async (c) => {
  const token = c.req.param('token');

  const invite = await c.env.DB.prepare(
    'SELECT id, status FROM workspace_invites WHERE invite_token = ?'
  ).bind(token).first<{ id: string; status: string }>();

  if (!invite) return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  if (invite.status !== 'pending') return errorResponse(c, 409, 'INVITE_USED', 'Already responded');

  await c.env.DB.prepare(
    "UPDATE workspace_invites SET status = 'declined' WHERE id = ?"
  ).bind(invite.id).run();

  return successResponse(c, { declined: true });
});

// ─── Workspace Deletion (GAP-010) ────────────────────────────

// Soft-delete workspace (owner only, all hackathons must be draft/archived)
workspaces.delete('/:workspaceId', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const workspaceId = c.req.param('workspaceId');

  const workspaceRole = await getWorkspaceRole(c, workspaceId, user.id);
  if (!workspaceRole || workspaceRole !== 'owner') {
    return errorResponse(c, 403, 'FORBIDDEN', 'Only owner can delete workspace');
  }

  const activeHackathons = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM hackathons WHERE workspace_id = ? AND status NOT IN ('draft', 'archived')"
  ).bind(workspaceId).first<{ count: number }>();

  if ((activeHackathons?.count ?? 0) > 0) {
    return errorResponse(c, 409, 'ACTIVE_HACKATHONS', 'All hackathons must be draft or archived before deleting workspace');
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'UPDATE workspaces SET deleted_at = ? WHERE id = ?'
  ).bind(now, workspaceId).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id, actor_type: 'user',
      action: 'workspace.deleted', entity_type: 'workspace', entity_id: workspaceId,
      details: { deleted_at: now },
    })
  );

  return successResponse(c, { deleted: true });
});

// ─── Workspace Ownership Transfer (GAP-011) ──────────────────

const transferOwnershipSchema = z.object({
  new_owner_id: z.string().uuid(),
});

// Transfer workspace ownership
workspaces.post('/:workspaceId/transfer', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const workspaceId = c.req.param('workspaceId');

  const workspaceRole = await getWorkspaceRole(c, workspaceId, user.id);
  if (!workspaceRole || workspaceRole !== 'owner') {
    return errorResponse(c, 403, 'FORBIDDEN', 'Only owner can transfer ownership');
  }

  const body = await validateBody(c, transferOwnershipSchema);
  if (body instanceof Response) return body;

  if (body.new_owner_id === user.id) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Cannot transfer ownership to yourself');
  }

  // Verify new owner is an existing workspace member
  const newOwnerMembership = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1'
  ).bind(workspaceId, body.new_owner_id).first<{ role: string }>();

  if (!newOwnerMembership) {
    return errorResponse(c, 404, 'NOT_FOUND', 'New owner must be an existing workspace member');
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE workspace_members SET role = 'owner' WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, body.new_owner_id),
    c.env.DB.prepare(
      "UPDATE workspace_members SET role = 'admin' WHERE workspace_id = ? AND user_id = ?"
    ).bind(workspaceId, user.id),
  ]);

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id, actor_type: 'user',
      action: 'workspace.ownership_transferred', entity_type: 'workspace', entity_id: workspaceId,
      details: { new_owner_id: body.new_owner_id, previous_owner_id: user.id },
    })
  );

  return successResponse(c, { transferred: true, new_owner_id: body.new_owner_id });
});

export default workspaces;
