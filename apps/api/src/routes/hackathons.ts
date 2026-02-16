import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonContext } from '../middleware/hackathon.js';
import { requireRole } from '../middleware/role.js';
import { generateETag, checkConditionalRequest } from '../lib/etag.js';
import { getHackathonDOStub } from '../lib/do-client.js';
import { VALID_TRANSITIONS } from '../lib/constants.js';

const hackathons = new Hono<AppEnv>();

// Create hackathon under a workspace
hackathons.post('/workspaces/:workspaceId/hackathons', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const workspaceId = c.req.param('workspaceId');

  // Verify user is workspace owner/admin
  const membership = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
  ).bind(workspaceId, user.id).first<{ role: string }>();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Must be workspace owner or admin');
  }

  const body = await c.req.json<{
    name: string; slug: string; description?: string;
    start_date?: string; end_date?: string; submission_deadline?: string;
    max_team_size?: number; min_team_size?: number; max_teams?: number;
    settings?: Record<string, unknown>; template_id?: string;
  }>();

  if (!body.name || !body.slug) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Name and slug are required');
  }

  // Check slug uniqueness
  const existingSlug = await c.env.DB.prepare(
    'SELECT id FROM hackathons WHERE slug = ?'
  ).bind(body.slug).first();

  if (existingSlug) {
    return errorResponse(c, 409, 'SLUG_TAKEN', 'This slug is already in use');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Apply template if provided
  let settings = body.settings ? JSON.stringify(body.settings) : null;
  if (body.template_id) {
    const template = await c.env.DB.prepare(
      'SELECT settings, tracks, rounds, rubric FROM hackathon_templates WHERE id = ?'
    ).bind(body.template_id).first<{
      settings: string; tracks: string; rounds: string; rubric: string;
    }>();
    if (template) {
      settings = template.settings;
      // TODO: Apply tracks, rounds, rubric from template
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO hackathons (id, workspace_id, name, slug, description, start_date, end_date, submission_deadline, max_team_size, min_team_size, max_teams, settings, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, workspaceId, body.name, body.slug, body.description ?? null,
    body.start_date ?? null, body.end_date ?? null, body.submission_deadline ?? null,
    body.max_team_size ?? 5, body.min_team_size ?? 1, body.max_teams ?? null,
    settings, user.id, now, now
  ).run();

  // Add creator as organizer
  await c.env.DB.prepare(
    'INSERT INTO organizer_roles (id, hackathon_id, user_id, role) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), id, user.id, 'organizer').run();

  // Initialize DO
  const stub = getHackathonDOStub(c.env.HACKATHON_SM, id);
  await stub.fetch(new Request('http://do/initialize', {
    method: 'POST',
    body: JSON.stringify({ hackathon_id: id, status: 'draft' }),
  }));

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: id,
      actor_id: user.id,
      actor_type: 'user',
      event_type: 'hackathon.created',
      entity_type: 'hackathon',
      entity_id: id,
      metadata: { name: body.name, slug: body.slug },
    })
  );

  const created = await c.env.DB.prepare('SELECT * FROM hackathons WHERE id = ?').bind(id).first();
  return successResponse(c, created, { status: 201 });
});

// List hackathons (public)
hackathons.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');
  const status = c.req.query('status');

  let query = 'SELECT * FROM hackathons';
  let countQuery = 'SELECT COUNT(*) as total FROM hackathons';
  const params: unknown[] = [];

  if (status) {
    query += ' WHERE status = ?';
    countQuery += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(query).bind(...params, limit, offset).all(),
    c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>(),
  ]);

  return paginatedResponse(c, rows.results || [], count?.total ?? 0, limit, offset);
});

// Get hackathon by slug
hackathons.get('/:slug', hackathonContext, async (c) => {
  const hackathon = c.get('hackathon')!;
  const full = await c.env.DB.prepare('SELECT * FROM hackathons WHERE id = ?')
    .bind(hackathon.id).first();

  if (!full) return errorResponse(c, 404, 'NOT_FOUND', 'Hackathon not found');

  const etag = await generateETag(full);
  if (checkConditionalRequest(c.req.header('If-None-Match'), etag)) {
    return c.body(null, 304);
  }

  c.header('ETag', etag);
  return successResponse(c, full);
});

// Update hackathon
hackathons.patch('/:slug', authMiddleware, hackathonContext, requireRole('co_organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<Record<string, unknown>>();

  const allowedFields = ['name', 'description', 'start_date', 'end_date', 'submission_deadline', 'max_team_size', 'min_team_size', 'max_teams', 'settings'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`${field} = ?`);
      values.push(field === 'settings' ? JSON.stringify(body[field]) : body[field]);
    }
  }

  if (updates.length === 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'No valid fields to update');
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(hackathon.id);

  await c.env.DB.prepare(
    `UPDATE hackathons SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      event_type: 'hackathon.updated',
      entity_type: 'hackathon',
      entity_id: hackathon.id,
      changes: body,
    })
  );

  const updated = await c.env.DB.prepare('SELECT * FROM hackathons WHERE id = ?').bind(hackathon.id).first();
  return successResponse(c, updated);
});

// State transition
hackathons.post('/:slug/transition', authMiddleware, hackathonContext, requireRole('organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<{ target_status: string; version: number }>();

  if (!body.target_status || body.version === undefined) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'target_status and version are required');
  }

  // Get submission_deadline for alarm setup
  const full = await c.env.DB.prepare(
    'SELECT submission_deadline FROM hackathons WHERE id = ?'
  ).bind(hackathon.id).first<{ submission_deadline: string | null }>();

  const stub = getHackathonDOStub(c.env.HACKATHON_SM, hackathon.id);
  const doRes = await stub.fetch(new Request('http://do/transition', {
    method: 'POST',
    body: JSON.stringify({
      target_status: body.target_status,
      version: body.version,
      submission_deadline: full?.submission_deadline,
    }),
  }));

  const result = await doRes.json() as { ok: boolean; data?: unknown; error?: unknown };
  if (!result.ok) {
    return c.json(result, doRes.status as 400 | 409);
  }

  // Sync D1
  await c.env.DB.prepare(
    'UPDATE hackathons SET status = ?, updated_at = ? WHERE id = ?'
  ).bind(body.target_status, new Date().toISOString(), hackathon.id).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      event_type: 'hackathon.transitioned',
      entity_type: 'hackathon',
      entity_id: hackathon.id,
      changes: { status: { old: hackathon.status, new: body.target_status } },
    })
  );

  return successResponse(c, result.data);
});

// Get DO state (reconciliation endpoint)
hackathons.get('/:slug/state', authMiddleware, hackathonContext, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;

  const stub = getHackathonDOStub(c.env.HACKATHON_SM, hackathon.id);
  const doRes = await stub.fetch(new Request('http://do/state'));
  const doState = await doRes.json() as { ok: boolean; data?: { status: string; version: number } };

  // Check D1 vs DO divergence
  if (doState.ok && doState.data && doState.data.status !== hackathon.status) {
    // Sync D1 to match DO (DO is source of truth)
    await c.env.DB.prepare(
      'UPDATE hackathons SET status = ?, updated_at = ? WHERE id = ?'
    ).bind(doState.data.status, new Date().toISOString(), hackathon.id).run();
  }

  return successResponse(c, { do_state: doState.data, d1_status: hackathon.status });
});

// Delete hackathon (draft only)
hackathons.delete('/:slug', authMiddleware, hackathonContext, requireRole('organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;

  if (hackathon.status !== 'draft') {
    return errorResponse(c, 409, 'INVALID_STATE', 'Only draft hackathons can be deleted');
  }

  await c.env.DB.prepare('DELETE FROM hackathons WHERE id = ?').bind(hackathon.id).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      event_type: 'hackathon.deleted',
      entity_type: 'hackathon',
      entity_id: hackathon.id,
    })
  );

  return successResponse(c, { deleted: true });
});

export default hackathons;
