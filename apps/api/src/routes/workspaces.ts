import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';

const workspaces = new Hono<AppEnv>();

// Create workspace
workspaces.post('/', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ name: string; slug: string; description?: string; type: string }>();

  if (!body.name || !body.slug || !body.type) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Name, slug, and type are required');
  }

  const existing = await c.env.DB.prepare('SELECT id FROM workspaces WHERE slug = ?').bind(body.slug).first();
  if (existing) return errorResponse(c, 409, 'SLUG_TAKEN', 'Slug already in use');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO workspaces (id, name, slug, description, type, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.name, body.slug, body.description ?? null, body.type, user.id, now, now).run();

  // Add creator as owner
  await c.env.DB.prepare(
    'INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), id, user.id, 'owner', now, now).run();

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

// Get workspace
workspaces.get('/:workspaceId', authMiddleware, async (c) => {
  const workspaceId = c.req.param('workspaceId');
  const workspace = await c.env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(workspaceId).first();
  if (!workspace) return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');
  return successResponse(c, workspace);
});

// Update workspace
workspaces.patch('/:workspaceId', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const workspaceId = c.req.param('workspaceId');

  const workspaceRole = user.workspaceRoles[workspaceId];

  if (!workspaceRole || !['owner', 'admin'].includes(workspaceRole)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Must be owner or admin');
  }

  const body = await c.req.json<Record<string, unknown>>();
  const allowedFields = ['name', 'description'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowedFields) {
    if (field in body) { updates.push(`${field} = ?`); values.push(body[field]); }
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
           u.name, u.email, u.image
    FROM workspace_members wm
    JOIN user u ON wm.user_id = u.id
    WHERE wm.workspace_id = ?
    ORDER BY wm.created_at ASC
  `).bind(workspaceId).all();
  return successResponse(c, members.results || []);
});

// Invite workspace member
workspaces.post('/:workspaceId/invites', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const workspaceId = c.req.param('workspaceId');

  const workspaceRole = user.workspaceRoles[workspaceId];

  if (!workspaceRole || !['owner', 'admin'].includes(workspaceRole)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Must be owner or admin');
  }

  const body = await c.req.json<{ email: string; role: string }>();
  if (!body.email || !body.role) return errorResponse(c, 400, 'VALIDATION_ERROR', 'Email and role required');

  const id = crypto.randomUUID();
  const inviteToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    `INSERT INTO workspace_invites (id, workspace_id, email, role, invite_token, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, workspaceId, body.email, body.role, inviteToken, user.id, expiresAt).run();

  return successResponse(c, { id, invite_token: inviteToken }, { status: 201 });
});

// Remove workspace member
workspaces.delete('/:workspaceId/members/:userId', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const workspaceId = c.req.param('workspaceId');
  const targetId = c.req.param('userId');

  const workspaceRole = user.workspaceRoles[workspaceId];

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

export default workspaces;
