import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, safeParseInt } from '../lib/validate.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  settings: z.record(z.unknown()).optional(),
  tracks: z.array(z.unknown()).optional(),
  rounds: z.array(z.unknown()).optional(),
  rubric: z.array(z.unknown()).optional(),
  workspace_id: z.string().uuid().optional(),
  is_public: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  settings: z.record(z.unknown()).optional(),
  tracks: z.array(z.unknown()).optional(),
  rounds: z.array(z.unknown()).optional(),
  rubric: z.array(z.unknown()).optional(),
  workspace_id: z.string().uuid().nullable().optional(),
  is_public: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TemplateRow {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  settings: string;
  tracks: string;
  rounds: string;
  rubric: string;
  is_platform_default: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_public: number;
}

function parseTemplateJson(row: TemplateRow) {
  return {
    ...row,
    settings: JSON.parse(row.settings || '{}'),
    tracks: JSON.parse(row.tracks || '[]'),
    rounds: JSON.parse(row.rounds || '[]'),
    rubric: JSON.parse(row.rubric || '[]'),
    is_platform_default: !!row.is_platform_default,
    is_public: !!row.is_public,
  };
}

/**
 * Check whether the user may modify a template.
 * Returns null if authorised, or an error string if not.
 */
async function canModifyTemplate(
  db: D1Database,
  template: TemplateRow,
  userId: string,
): Promise<string | null> {
  // Creator can always modify
  if (template.created_by === userId) return null;

  // If the template belongs to a workspace, owner/admin can modify
  if (template.workspace_id) {
    const membership = await db.prepare(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1',
    ).bind(template.workspace_id, userId).first<{ role: string }>();

    if (membership && ['owner', 'admin'].includes(membership.role)) {
      return null;
    }
  }

  return 'You do not have permission to modify this template';
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const templates = new Hono<AppEnv>();

// All template routes require authentication
templates.use('/*', authMiddleware);

// GET / — List templates (paginated, filterable)
templates.get('/', async (c) => {
  const user = c.get('user')!;
  const limit = Math.min(Math.max(safeParseInt(c.req.query('limit'), 20), 1), 100);
  const offset = Math.max(safeParseInt(c.req.query('offset'), 0), 0);
  const workspaceId = c.req.query('workspace_id');
  const publicOnly = c.req.query('public_only') === 'true';

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (workspaceId) {
    conditions.push('workspace_id = ?');
    params.push(workspaceId);
  }

  if (publicOnly) {
    conditions.push('is_public = 1');
  } else {
    // When not filtering to public only, show templates the user can access:
    // - templates they created
    // - public templates
    // - templates in workspaces they belong to
    conditions.push('(is_public = 1 OR created_by = ? OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?))');
    params.push(user.id, user.id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `SELECT * FROM hackathon_templates ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const countQuery = `SELECT COUNT(*) as total FROM hackathon_templates ${whereClause}`;

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(query).bind(...params, limit, offset).all<TemplateRow>(),
    c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>(),
  ]);

  const parsed = (rows.results || []).map(parseTemplateJson);

  return paginatedResponse(c, parsed, count?.total ?? 0, limit, offset);
});

// POST / — Create template
templates.post('/', async (c) => {
  const user = c.get('user')!;
  const body = await validateBody(c, createTemplateSchema);
  if (body instanceof Response) return body;

  // If workspace_id is provided, verify user is a member
  if (body.workspace_id) {
    const membership = await c.env.DB.prepare(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1',
    ).bind(body.workspace_id, user.id).first<{ role: string }>();

    if (!membership) {
      return errorResponse(c, 403, 'FORBIDDEN', 'You must be a member of this workspace');
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO hackathon_templates (id, workspace_id, name, description, settings, tracks, rounds, rubric, is_platform_default, created_by, created_at, updated_at, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
  ).bind(
    id,
    body.workspace_id ?? null,
    body.name,
    body.description ?? null,
    body.settings ? JSON.stringify(body.settings) : '{}',
    body.tracks ? JSON.stringify(body.tracks) : '[]',
    body.rounds ? JSON.stringify(body.rounds) : '[]',
    body.rubric ? JSON.stringify(body.rubric) : '[]',
    user.id,
    now,
    now,
    body.is_public ? 1 : 0,
  ).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'template.created',
      entity_type: 'hackathon_template',
      entity_id: id,
      details: { name: body.name, workspace_id: body.workspace_id ?? null },
    }),
  );

  const created = await c.env.DB.prepare(
    'SELECT * FROM hackathon_templates WHERE id = ?',
  ).bind(id).first<TemplateRow>();

  return successResponse(c, created ? parseTemplateJson(created) : null, { status: 201 });
});

// GET /:templateId — Get single template
templates.get('/:templateId', async (c) => {
  const templateId = c.req.param('templateId');

  const template = await c.env.DB.prepare(
    'SELECT * FROM hackathon_templates WHERE id = ?',
  ).bind(templateId).first<TemplateRow>();

  if (!template) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Template not found');
  }

  return successResponse(c, parseTemplateJson(template));
});

// PATCH /:templateId — Update template
templates.patch('/:templateId', async (c) => {
  const user = c.get('user')!;
  const templateId = c.req.param('templateId');

  const template = await c.env.DB.prepare(
    'SELECT * FROM hackathon_templates WHERE id = ?',
  ).bind(templateId).first<TemplateRow>();

  if (!template) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Template not found');
  }

  const permError = await canModifyTemplate(c.env.DB, template, user.id);
  if (permError) {
    return errorResponse(c, 403, 'FORBIDDEN', permError);
  }

  const body = await validateBody(c, updateTemplateSchema);
  if (body instanceof Response) return body;

  const updates: string[] = [];
  const values: unknown[] = [];
  const changes: Record<string, unknown> = {};

  if (body.name !== undefined) {
    updates.push('name = ?');
    values.push(body.name);
    changes.name = { from: template.name, to: body.name };
  }
  if (body.description !== undefined) {
    updates.push('description = ?');
    values.push(body.description);
    changes.description = { from: template.description, to: body.description };
  }
  if (body.settings !== undefined) {
    updates.push('settings = ?');
    values.push(JSON.stringify(body.settings));
    changes.settings = true;
  }
  if (body.tracks !== undefined) {
    updates.push('tracks = ?');
    values.push(JSON.stringify(body.tracks));
    changes.tracks = true;
  }
  if (body.rounds !== undefined) {
    updates.push('rounds = ?');
    values.push(JSON.stringify(body.rounds));
    changes.rounds = true;
  }
  if (body.rubric !== undefined) {
    updates.push('rubric = ?');
    values.push(JSON.stringify(body.rubric));
    changes.rubric = true;
  }
  if (body.workspace_id !== undefined) {
    updates.push('workspace_id = ?');
    values.push(body.workspace_id);
    changes.workspace_id = { from: template.workspace_id, to: body.workspace_id };
  }
  if (body.is_public !== undefined) {
    updates.push('is_public = ?');
    values.push(body.is_public ? 1 : 0);
    changes.is_public = { from: !!template.is_public, to: body.is_public };
  }

  if (updates.length === 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'No fields to update');
  }

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  values.push(now);

  await c.env.DB.prepare(
    `UPDATE hackathon_templates SET ${updates.join(', ')} WHERE id = ?`,
  ).bind(...values, templateId).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'template.updated',
      entity_type: 'hackathon_template',
      entity_id: templateId,
      changes,
    }),
  );

  const updated = await c.env.DB.prepare(
    'SELECT * FROM hackathon_templates WHERE id = ?',
  ).bind(templateId).first<TemplateRow>();

  return successResponse(c, updated ? parseTemplateJson(updated) : null);
});

// DELETE /:templateId — Delete template
templates.delete('/:templateId', async (c) => {
  const user = c.get('user')!;
  const templateId = c.req.param('templateId');

  const template = await c.env.DB.prepare(
    'SELECT * FROM hackathon_templates WHERE id = ?',
  ).bind(templateId).first<TemplateRow>();

  if (!template) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Template not found');
  }

  const permError = await canModifyTemplate(c.env.DB, template, user.id);
  if (permError) {
    return errorResponse(c, 403, 'FORBIDDEN', permError);
  }

  await c.env.DB.prepare(
    'DELETE FROM hackathon_templates WHERE id = ?',
  ).bind(templateId).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'template.deleted',
      entity_type: 'hackathon_template',
      entity_id: templateId,
      details: { name: template.name, workspace_id: template.workspace_id },
    }),
  );

  return successResponse(c, { deleted: true });
});

export default templates;
