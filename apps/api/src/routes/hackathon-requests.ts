import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/platform-admin.js';
import { validateBody } from '../lib/validate.js';
import { z } from 'zod';

const createHackathonRequestSchema = z.object({
  workspace_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  num_events: z.number().int().positive().optional(),
  expected_participants: z.number().int().positive().optional(),
  team_min_size: z.number().int().min(1).optional(),
  team_max_size: z.number().int().min(1).optional(),
  additional_details: z.string().optional(),
});

const updateHackathonRequestStatusSchema = z.object({
  status: z.enum(['submitted', 'under_review', 'approved', 'rejected', 'changes_requested', 'building', 'ready']),
  admin_notes: z.string().optional(),
});

const resubmitHackathonRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  num_events: z.number().int().positive().optional(),
  expected_participants: z.number().int().positive().optional(),
  team_min_size: z.number().int().min(1).optional(),
  team_max_size: z.number().int().min(1).optional(),
  additional_details: z.string().optional(),
});

const hackathonRequests = new Hono<AppEnv>();

// ─── Organizer endpoints (authenticated) ──────────────────────

// Create a hackathon request
hackathonRequests.post('/', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = await validateBody(c, createHackathonRequestSchema);
  if (body instanceof Response) return body;

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

  // Notify platform admins of new request
  try {
    await c.env.NOTIFICATION_QUEUE.send({
      type: 'hackathon.request.submitted',
      hackathon_id: id,
      actor_id: user.id,
      data: {
        request_id: id,
        workspace_id: body.workspace_id,
        requested_by: user.id,
        title: body.title,
      },
    });
  } catch (_) { /* notification failure should not block creation */ }

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
  const body = await validateBody(c, updateHackathonRequestStatusSchema);
  if (body instanceof Response) return body;

  const existing = await c.env.DB.prepare('SELECT * FROM hackathon_requests WHERE id = ?').bind(id).first<Record<string, unknown>>();
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

  // ── Auto-create hackathon when status becomes "ready" ──────
  if (body.status === 'ready') {
    const hackathonId = crypto.randomUUID();
    const slug = (existing.title as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const uniqueSlug = `${slug}-${hackathonId.slice(0, 6)}`;

    // Check slug uniqueness
    const existingSlug = await c.env.DB.prepare('SELECT id FROM hackathons WHERE slug = ?').bind(uniqueSlug).first();
    const finalSlug = existingSlug ? `${uniqueSlug}-${Date.now().toString(36)}` : uniqueSlug;

    await c.env.DB.prepare(
      `INSERT INTO hackathons (id, workspace_id, slug, title, description, status, starts_at, judging_starts, min_team_size, max_team_size, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      hackathonId, existing.workspace_id as string, finalSlug,
      existing.title as string, existing.description as string | null,
      existing.starts_at as string | null, existing.ends_at as string | null,
      existing.team_min_size as number ?? 1, existing.team_max_size as number ?? 5,
      existing.requested_by as string, now, now
    ).run();

    // Add requester as organizer
    await c.env.DB.prepare(
      `INSERT INTO organizer_roles (id, hackathon_id, user_id, role, created_at) VALUES (?, ?, ?, 'organizer', ?)`
    ).bind(crypto.randomUUID(), hackathonId, existing.requested_by as string, now).run();

    // Link hackathon to the request
    await c.env.DB.prepare(
      `UPDATE hackathon_requests SET hackathon_id = ?, admin_notes = COALESCE(admin_notes || '\n', '') || ? WHERE id = ?`
    ).bind(hackathonId, `[Auto-created hackathon: ${finalSlug} (${hackathonId})]`, id).run();
  }

  // ── Dispatch notification for status transition ────────────
  try {
    await c.env.NOTIFICATION_QUEUE.send({
      type: `hackathon.request.${body.status}`,
      hackathon_id: id, // Use request ID as context key
      actor_id: c.get('user')!.id,
      data: {
        request_id: id,
        workspace_id: existing.workspace_id,
        requested_by: existing.requested_by,
        title: existing.title,
        admin_notes: body.admin_notes || null,
        new_status: body.status,
      },
    });
  } catch (_) { /* notification failure should not block status update */ }

  const updated = await c.env.DB.prepare(`
    SELECT hr.*, w.name as workspace_name, w.slug as workspace_slug, u.name as requester_name, u.email as requester_email,
           h.slug as hackathon_slug
    FROM hackathon_requests hr
    JOIN workspaces w ON hr.workspace_id = w.id
    JOIN users u ON hr.requested_by = u.id
    LEFT JOIN hackathons h ON hr.hackathon_id = h.id
    WHERE hr.id = ?
  `).bind(id).first();

  return successResponse(c, updated);
});

// Resubmit a request after changes_requested (organizer)
hackathonRequests.put('/:id/resubmit', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM hackathon_requests WHERE id = ? AND requested_by = ?'
  ).bind(id, user.id).first<Record<string, unknown>>();

  if (!existing) return errorResponse(c, 404, 'NOT_FOUND', 'Request not found');

  if (existing.status !== 'changes_requested') {
    return errorResponse(c, 400, 'INVALID_STATE', 'Only requests with changes_requested status can be resubmitted');
  }

  const body = await validateBody(c, resubmitHackathonRequestSchema);
  if (body instanceof Response) return body;

  const now = new Date().toISOString();
  const history = JSON.parse((existing.status_history as string) || '[]');
  history.push({
    status: 'submitted',
    timestamp: now,
    note: 'Resubmitted by organizer after requested changes',
  });

  await c.env.DB.prepare(`
    UPDATE hackathon_requests
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        starts_at = COALESCE(?, starts_at),
        ends_at = COALESCE(?, ends_at),
        num_events = COALESCE(?, num_events),
        expected_participants = COALESCE(?, expected_participants),
        team_min_size = COALESCE(?, team_min_size),
        team_max_size = COALESCE(?, team_max_size),
        additional_details = COALESCE(?, additional_details),
        status = 'submitted',
        status_history = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    body.title || null, body.description || null,
    body.starts_at || null, body.ends_at || null,
    body.num_events || null, body.expected_participants || null,
    body.team_min_size || null, body.team_max_size || null,
    body.additional_details || null,
    JSON.stringify(history), now, id
  ).run();

  // Notify admins of resubmission
  try {
    await c.env.NOTIFICATION_QUEUE.send({
      type: 'hackathon.request.submitted',
      hackathon_id: id,
      actor_id: user.id,
      data: {
        request_id: id,
        workspace_id: existing.workspace_id,
        requested_by: user.id,
        title: body.title || existing.title,
        resubmission: true,
      },
    });
  } catch (_) { /* notification failure should not block resubmit */ }

  const updated = await c.env.DB.prepare(`
    SELECT hr.*, w.name as workspace_name, w.slug as workspace_slug
    FROM hackathon_requests hr
    JOIN workspaces w ON hr.workspace_id = w.id
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
