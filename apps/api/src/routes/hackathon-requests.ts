import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/platform-admin.js';

const hackathonRequests = new Hono<AppEnv>();

// ─── Organizer endpoints (authenticated) ──────────────────────

// Create a hackathon request
hackathonRequests.post('/', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{
    workspace_id: string;
    title: string;
    description?: string;
    starts_at?: string;
    ends_at?: string;
    num_events?: number;
    expected_participants?: number;
    team_min_size?: number;
    team_max_size?: number;
    additional_details?: string;
  }>();

  if (!body.workspace_id || !body.title) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'workspace_id and title are required');
  }

  // Verify user is a member of the workspace
  const membership = await c.env.DB.prepare(
    'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
  ).bind(body.workspace_id, user.id).first();

  if (!membership) {
    return errorResponse(c, 403, 'FORBIDDEN', 'You are not a member of this workspace');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const initialHistory = JSON.stringify([
    { status: 'submitted', timestamp: now, note: 'Request submitted' }
  ]);

  await c.env.DB.prepare(`
    INSERT INTO hackathon_requests (id, workspace_id, requested_by, title, description, starts_at, ends_at, num_events, expected_participants, team_min_size, team_max_size, additional_details, status, status_history, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?)
  `).bind(
    id, body.workspace_id, user.id, body.title,
    body.description || null, body.starts_at || null, body.ends_at || null,
    body.num_events || null, body.expected_participants || null,
    body.team_min_size || null, body.team_max_size || null,
    body.additional_details || null,
    initialHistory, now, now
  ).run();

  const request = await c.env.DB.prepare('SELECT * FROM hackathon_requests WHERE id = ?').bind(id).first();
  return successResponse(c, request, { status: 201 });
});

// List my hackathon requests (for organizer)
hackathonRequests.get('/', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(`
      SELECT hr.*, w.name as workspace_name, w.slug as workspace_slug, u.name as requester_name, u.email as requester_email
      FROM hackathon_requests hr
      JOIN workspaces w ON hr.workspace_id = w.id
      JOIN users u ON hr.requested_by = u.id
      WHERE hr.requested_by = ?
      ORDER BY hr.created_at DESC LIMIT ? OFFSET ?
    `).bind(user.id, limit, offset).all(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM hackathon_requests WHERE requested_by = ?').bind(user.id).first<{ total: number }>(),
  ]);

  return paginatedResponse(c, rows.results || [], count?.total ?? 0, limit, offset);
});

// Get a single request by ID (organizer must own it)
hackathonRequests.get('/:id', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');

  const request = await c.env.DB.prepare(`
    SELECT hr.*, w.name as workspace_name, w.slug as workspace_slug
    FROM hackathon_requests hr
    JOIN workspaces w ON hr.workspace_id = w.id
    WHERE hr.id = ? AND hr.requested_by = ?
  `).bind(id, user.id).first();

  if (!request) return errorResponse(c, 404, 'NOT_FOUND', 'Request not found');
  return successResponse(c, request);
});

// ─── Admin endpoints ──────────────────────────────────────────

// List all hackathon requests (admin only)
hackathonRequests.get('/admin/all', authMiddleware, requirePlatformAdmin, async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');
  const status = c.req.query('status');

  let whereClause = '';
  const binds: (string | number)[] = [];

  if (status) {
    whereClause = 'WHERE hr.status = ?';
    binds.push(status);
  }

  binds.push(limit, offset);

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(`
      SELECT hr.*, w.name as workspace_name, w.slug as workspace_slug, u.name as requester_name, u.email as requester_email
      FROM hackathon_requests hr
      JOIN workspaces w ON hr.workspace_id = w.id
      JOIN users u ON hr.requested_by = u.id
      ${whereClause}
      ORDER BY hr.created_at DESC LIMIT ? OFFSET ?
    `).bind(...binds).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM hackathon_requests hr ${whereClause}`)
      .bind(...(status ? [status] : [])).first<{ total: number }>(),
  ]);

  return paginatedResponse(c, rows.results || [], count?.total ?? 0, limit, offset);
});

// Update hackathon request status (admin only)
hackathonRequests.patch('/admin/:id', authMiddleware, requirePlatformAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    status: string;
    admin_notes?: string;
  }>();

  const validStatuses = ['submitted', 'under_review', 'approved', 'rejected', 'changes_requested', 'building', 'ready'];
  if (!validStatuses.includes(body.status)) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', `status must be one of: ${validStatuses.join(', ')}`);
  }

  const existing = await c.env.DB.prepare('SELECT * FROM hackathon_requests WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse(c, 404, 'NOT_FOUND', 'Request not found');

  const now = new Date().toISOString();
  const history = JSON.parse((existing.status_history as string) || '[]');
  history.push({
    status: body.status,
    timestamp: now,
    note: body.admin_notes || `Status updated to ${body.status}`,
  });

  await c.env.DB.prepare(`
    UPDATE hackathon_requests
    SET status = ?, admin_notes = COALESCE(?, admin_notes), status_history = ?, updated_at = ?
    WHERE id = ?
  `).bind(body.status, body.admin_notes || null, JSON.stringify(history), now, id).run();

  const updated = await c.env.DB.prepare(`
    SELECT hr.*, w.name as workspace_name, w.slug as workspace_slug, u.name as requester_name, u.email as requester_email
    FROM hackathon_requests hr
    JOIN workspaces w ON hr.workspace_id = w.id
    JOIN users u ON hr.requested_by = u.id
    WHERE hr.id = ?
  `).bind(id).first();

  return successResponse(c, updated);
});

// Get pending request count (admin only)
hackathonRequests.get('/admin/stats', authMiddleware, requirePlatformAdmin, async (c) => {
  const counts = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
      SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'building' THEN 1 ELSE 0 END) as building,
      SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'changes_requested' THEN 1 ELSE 0 END) as changes_requested
    FROM hackathon_requests
  `).first();

  return successResponse(c, counts);
});

export default hackathonRequests;
