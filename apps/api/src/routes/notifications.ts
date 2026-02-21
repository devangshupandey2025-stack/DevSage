import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';

const notifications = new Hono<AppEnv>();
notifications.use('/*', authMiddleware);

// List notifications for current user
notifications.get('/', async (c) => {
  const user = c.get('user')!;
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');
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

export default notifications;
