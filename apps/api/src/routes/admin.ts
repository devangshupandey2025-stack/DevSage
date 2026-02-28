import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/platform-admin.js';
import { backfillAuditHashes, insertAuditEvent } from '../lib/audit.js';
import { validateBody } from '../lib/validate.js';
import { z } from 'zod';

const addPlatformAdminSchema = z.object({
  user_id: z.string().uuid(),
});

const adminInitializeRoundSchema = z.object({
  is_initialized: z.boolean(),
});

const createPlatformInviteSchema = z.object({
  email: z.string().email(),
});

const adminCreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  type: z.string().min(1),
  description: z.string().optional(),
  owner_email: z.string().email(),
});

const admin = new Hono<AppEnv>();
admin.use('/*', authMiddleware, requirePlatformAdmin);

// List all users
admin.get('/users', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');
  const [rows, count] = await Promise.all([
    c.env.DB.prepare('SELECT id, email, name, avatar_url as image, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(limit, offset).all(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM users').first<{ total: number }>(),
  ]);
  return paginatedResponse(c, rows.results || [], count?.total ?? 0, limit, offset);
});

// List all hackathons
admin.get('/hackathons', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');
  const [rows, count] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM hackathons ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM hackathons').first<{ total: number }>(),
  ]);
  return paginatedResponse(c, rows.results || [], count?.total ?? 0, limit, offset);
});

// Add platform admin
admin.post('/admins', async (c) => {
  const user = c.get('user')!;
  const body = await validateBody(c, addPlatformAdminSchema);
  if (body instanceof Response) return body;

  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO platform_admins (id, user_id, role, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, body.user_id, 'platform_admin', user.id, new Date().toISOString()).run();
  } catch {
    return errorResponse(c, 409, 'ALREADY_ADMIN', 'User is already an admin');
  }
  return successResponse(c, { id }, { status: 201 });
});

// Remove platform admin
admin.delete('/admins/:userId', async (c) => {
  const user = c.get('user')!;
  const targetId = c.req.param('userId');
  if (targetId === user.id) return errorResponse(c, 409, 'CANNOT_REMOVE_SELF', 'Cannot remove yourself');
  await c.env.DB.prepare('DELETE FROM platform_admins WHERE user_id = ?').bind(targetId).run();
  return successResponse(c, { removed: true });
});

// List platform admins
admin.get('/admins', async (c) => {
  const admins = await c.env.DB.prepare(`
    SELECT pa.id, pa.user_id, pa.created_at, u.name, u.email
    FROM platform_admins pa JOIN users u ON pa.user_id = u.id
    ORDER BY pa.created_at ASC
  `).all();
  return successResponse(c, admins.results || []);
});

// Trigger audit hash backfill
admin.post('/audit/backfill', async (c) => {
  const processed = await backfillAuditHashes(c.env.DB, 500);
  return successResponse(c, { processed });
});

// System stats
admin.get('/stats', async (c) => {
  const [users, hackathons, teams, submissions] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM hackathons').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM teams').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM submissions').first<{ count: number }>(),
  ]);

  return successResponse(c, {
    users: users?.count ?? 0,
    hackathons: hackathons?.count ?? 0,
    teams: teams?.count ?? 0,
    submissions: submissions?.count ?? 0,
  });
});

// ─── Hackathon Detail (admin) ────────────────────────────────

admin.get('/hackathons/:hackathonId', async (c) => {
  const hackathonId = c.req.param('hackathonId');
  const hackathon = await c.env.DB.prepare('SELECT * FROM hackathons WHERE id = ?').bind(hackathonId).first();
  if (!hackathon) return errorResponse(c, 404, 'NOT_FOUND', 'Hackathon not found');
  return successResponse(c, hackathon);
});

// ─── Admin Round Management ──────────────────────────────────

// List rounds for a hackathon (admin view)
admin.get('/hackathons/:hackathonId/rounds', async (c) => {
  const hackathonId = c.req.param('hackathonId');
  const rows = await c.env.DB.prepare(
    'SELECT * FROM hackathon_rounds WHERE hackathon_id = ? ORDER BY round_number ASC'
  ).bind(hackathonId).all();
  return successResponse(c, rows.results || []);
});

// Initialize / un-initialize a round (admin-only toggle)
admin.patch('/hackathons/:hackathonId/rounds/:roundId/initialize', async (c) => {
  const hackathonId = c.req.param('hackathonId');
  const roundId = c.req.param('roundId');
  const body = await validateBody(c, adminInitializeRoundSchema);
  if (body instanceof Response) return body;

  // Verify round belongs to this hackathon
  const round = await c.env.DB.prepare(
    'SELECT * FROM hackathon_rounds WHERE id = ? AND hackathon_id = ?'
  ).bind(roundId, hackathonId).first();

  if (!round) return errorResponse(c, 404, 'NOT_FOUND', 'Round not found');

  const now = new Date().toISOString();
  const initValue = body.is_initialized ? 1 : 0;

  // If initializing, also set status to 'active' and started_at
  if (body.is_initialized) {
    await c.env.DB.prepare(
      `UPDATE hackathon_rounds SET is_initialized = ?, status = 'active', started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?`
    ).bind(initValue, now, now, roundId).run();
  } else {
    await c.env.DB.prepare(
      'UPDATE hackathon_rounds SET is_initialized = ?, updated_at = ? WHERE id = ?'
    ).bind(initValue, now, roundId).run();
  }

  const updated = await c.env.DB.prepare('SELECT * FROM hackathon_rounds WHERE id = ?').bind(roundId).first();
  return successResponse(c, updated);
});

// ─── Invites ─────────────────────────────────────────────────

admin.get('/invites', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '10'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');
  const [rows, count] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM platform_invites ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(limit, offset).all(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM platform_invites').first<{ total: number }>(),
  ]);
  return paginatedResponse(c, rows.results || [], count?.total ?? 0, limit, offset);
});

admin.post('/invites', async (c) => {
  const user = c.get('user')!;
  const body = await validateBody(c, createPlatformInviteSchema);
  if (body instanceof Response) return body;

  const id = crypto.randomUUID();
  const invite_code = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    await c.env.DB.prepare(
      'INSERT INTO platform_invites (id, email, invite_code, status, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, body.email, invite_code, 'pending', user.id, now, expires).run();
  } catch {
    return errorResponse(c, 409, 'DUPLICATE', 'Invite already exists for this email');
  }
  return successResponse(c, { id, email: body.email, invite_code, status: 'pending', created_at: now, expires_at: expires }, { status: 201 });
});

admin.delete('/invites/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE platform_invites SET status = 'revoked' WHERE id = ? AND status = 'pending'").bind(id).run();
  return successResponse(c, { revoked: true });
});

// ─── Workspaces ──────────────────────────────────────────────

admin.get('/workspaces', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT w.*,
      (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) as member_count,
      (SELECT COUNT(*) FROM hackathons h WHERE h.workspace_id = w.id) as hackathon_count
    FROM workspaces w
    ORDER BY w.created_at DESC
  `).all();
  return successResponse(c, rows.results || []);
});

// Create workspace (admin-only) + invite owner
admin.post('/workspaces', async (c) => {
  const user = c.get('user')!;
  const body = await validateBody(c, adminCreateWorkspaceSchema);
  if (body instanceof Response) return body;

  const existing = await c.env.DB.prepare('SELECT id FROM workspaces WHERE slug = ?').bind(body.slug).first();
  if (existing) return errorResponse(c, 409, 'SLUG_TAKEN', 'Slug already in use');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO workspaces (id, name, slug, description, type, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.name, body.slug, body.description ?? '', body.type, user.id, now, now).run();

  // Create workspace invite for the owner
  const inviteId = crypto.randomUUID();
  const inviteToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    `INSERT INTO workspace_invites (id, workspace_id, email, role, invite_token, invited_by, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(inviteId, id, body.owner_email, 'owner', inviteToken, user.id, 'pending', expiresAt).run();

  // Send invite email
  const { sendEmail } = await import('../services/email.js');
  const platformUrl = c.env.PLATFORM_URL || 'https://platform.devsage.org';
  const inviteLink = `${platformUrl}/invite/workspace/${inviteToken}`;

  c.executionCtx.waitUntil(
    Promise.all([
      sendEmail(c.env, {
        to: body.owner_email,
        subject: `You've been invited to manage ${body.name} on DevSage`,
        html: `
          <h2>Workspace Invitation</h2>
          <p>You've been invited as the <strong>Owner</strong> of the <strong>${body.name}</strong> workspace on DevSage.</p>
          <p><a href="${inviteLink}" style="display:inline-block;padding:12px 24px;background:#CCFF00;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;">Accept Invitation</a></p>
          <p>This invite expires in 7 days.</p>
        `,
      }),
      insertAuditEvent(c.env.DB, {
        actor_id: user.id, actor_type: 'user',
        action: 'workspace.created', entity_type: 'workspace', entity_id: id,
        details: { name: body.name, owner_email: body.owner_email },
      }),
    ])
  );

  const created = await c.env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(id).first();
  return successResponse(c, { workspace: created, invite_token: inviteToken }, { status: 201 });
});

// Get workspace detail (admin)
admin.get('/workspaces/:workspaceId', async (c) => {
  const workspaceId = c.req.param('workspaceId');
  const workspace = await c.env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(workspaceId).first();
  if (!workspace) return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');

  const [members, hackathons, invites] = await Promise.all([
    c.env.DB.prepare(`
      SELECT wm.id, wm.user_id, wm.role, wm.created_at,
             u.name, u.email, u.avatar_url as image
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
      ORDER BY wm.created_at ASC
    `).bind(workspaceId).all(),
    c.env.DB.prepare(
      'SELECT id, title, slug, status, created_at FROM hackathons WHERE workspace_id = ? ORDER BY created_at DESC'
    ).bind(workspaceId).all(),
    c.env.DB.prepare(
      'SELECT id, email, role, status, created_at, expires_at FROM workspace_invites WHERE workspace_id = ? ORDER BY created_at DESC'
    ).bind(workspaceId).all(),
  ]);

  return successResponse(c, {
    ...workspace,
    members: members.results || [],
    hackathons: hackathons.results || [],
    invites: invites.results || [],
  });
});

export default admin;
