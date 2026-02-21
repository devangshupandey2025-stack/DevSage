import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/platform-admin.js';
import { backfillAuditHashes } from '../lib/audit.js';

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
  const body = await c.req.json<{ user_id: string }>();
  if (!body.user_id) return errorResponse(c, 400, 'VALIDATION_ERROR', 'user_id required');

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
  const body = await c.req.json<{ is_initialized: boolean }>();

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

export default admin;
