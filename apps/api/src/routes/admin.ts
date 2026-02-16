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
    c.env.DB.prepare('SELECT id, email, name, github_username, auth_provider, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?')
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
      'INSERT INTO platform_admins (id, user_id, added_by) VALUES (?, ?, ?)'
    ).bind(id, body.user_id, user.id).run();
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
    c.env.DB.prepare('SELECT COUNT(*) as count FROM teams WHERE status != ?').bind('dissolved').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM submissions').first<{ count: number }>(),
  ]);

  return successResponse(c, {
    users: users?.count ?? 0,
    hackathons: hackathons?.count ?? 0,
    teams: teams?.count ?? 0,
    submissions: submissions?.count ?? 0,
  });
});

export default admin;
