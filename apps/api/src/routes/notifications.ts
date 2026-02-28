import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, safeParseInt } from '../lib/validate.js';
import { z } from 'zod';

const notifications = new Hono<AppEnv>();
notifications.use('/*', authMiddleware);

// List notifications for current user
notifications.get('/', async (c) => {
  const user = c.get('user')!;
  const limit = Math.min(Math.max(safeParseInt(c.req.query('limit'), 20), 1), 100);
  const offset = Math.max(safeParseInt(c.req.query('offset'), 0), 0);
  const hackathonId = c.req.query('hackathon_id');

  let query = 'SELECT * FROM in_app_notifications WHERE user_id = ?';
  let countQuery = 'SELECT COUNT(*) as total FROM in_app_notifications WHERE user_id = ?';
  const params: unknown[] = [user.id];

  if (hackathonId) {
    query += ' AND hackathon_id = ?';
    countQuery += ' AND hackathon_id = ?';
    params.push(hackathonId);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(query).bind(...params, limit, offset).all(),
    c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>(),
  ]);

  return paginatedResponse(c, rows.results || [], count?.total ?? 0, limit, offset);
});

// Get unread count
notifications.get('/unread-count', async (c) => {
  const user = c.get('user')!;
  const result = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM in_app_notifications WHERE user_id = ? AND read_at IS NULL'
  ).bind(user.id).first<{ count: number }>();
  return successResponse(c, { count: result?.count ?? 0 });
});

// Mark as read
notifications.patch('/:notificationId/read', async (c) => {
  const user = c.get('user')!;
  const notificationId = c.req.param('notificationId');
  await c.env.DB.prepare(
    'UPDATE in_app_notifications SET read_at = ? WHERE id = ? AND user_id = ?'
  ).bind(new Date().toISOString(), notificationId, user.id).run();
  return successResponse(c, { read: true });
});

// Mark all as read
notifications.patch('/read-all', async (c) => {
  const user = c.get('user')!;
  await c.env.DB.prepare(
    'UPDATE in_app_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL'
  ).bind(new Date().toISOString(), user.id).run();
  return successResponse(c, { read_all: true });
});

// ─── Notification Preferences (GAP-012) ──────────────────────

// Get notification preferences for current user
notifications.get('/preferences', async (c) => {
  const user = c.get('user')!;
  const hackathonId = c.req.query('hackathon_id');

  if (hackathonId) {
    const prefs = await c.env.DB.prepare(
      'SELECT * FROM hackathon_notification_config WHERE user_id = ? AND hackathon_id = ?'
    ).bind(user.id, hackathonId).first();
    return successResponse(c, prefs ?? null);
  }

  const rows = await c.env.DB.prepare(
    'SELECT * FROM hackathon_notification_config WHERE user_id = ?'
  ).bind(user.id).all();
  return successResponse(c, rows.results || []);
});

// Set notification preferences
const notificationPreferencesSchema = z.object({
  hackathon_id: z.string().uuid(),
  email_enabled: z.boolean(),
  in_app_enabled: z.boolean(),
});

notifications.put('/preferences', async (c) => {
  const user = c.get('user')!;

  const body = await validateBody(c, notificationPreferencesSchema);
  if (body instanceof Response) return body;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO hackathon_notification_config (id, hackathon_id, user_id, email_enabled, in_app_enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(hackathon_id, user_id) DO UPDATE SET email_enabled = ?, in_app_enabled = ?`
  ).bind(
    id, body.hackathon_id, user.id,
    body.email_enabled ? 1 : 0, body.in_app_enabled ? 1 : 0, now,
    body.email_enabled ? 1 : 0, body.in_app_enabled ? 1 : 0
  ).run();

  return successResponse(c, { hackathon_id: body.hackathon_id, email_enabled: body.email_enabled, in_app_enabled: body.in_app_enabled });
});

export default notifications;
