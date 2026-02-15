import { Hono } from 'hono';
import { eq, and, desc, sql, lt } from 'drizzle-orm';
import { createDbClient, inAppNotifications } from '@devsage/db';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { successResponse, errorResponse, cursorPaginatedResponse, noContentResponse } from '../lib/response.js';

const notifications = new Hono<AuthAppEnv>();

// All notification routes require authentication
notifications.use('*', authMiddleware);

/**
 * GET /notifications — List in-app notifications (cursor-paginated)
 * Query params: limit (1-100, default 20), cursor (ISO timestamp), unread_only (boolean)
 */
notifications.get('/', async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  const limitParam = c.req.query('limit');
  const cursor = c.req.query('cursor');
  const unreadOnly = c.req.query('unread_only') === 'true';

  const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100);

  const conditions = [eq(inAppNotifications.user_id, user.sub)];
  if (unreadOnly) {
    conditions.push(eq(inAppNotifications.read, 0));
  }
  if (cursor) {
    conditions.push(lt(inAppNotifications.created_at, cursor));
  }

  const rows = await db
    .select()
    .from(inAppNotifications)
    .where(and(...conditions))
    .orderBy(desc(inAppNotifications.created_at))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && data.length > 0
    ? data[data.length - 1].created_at
    : null;

  return cursorPaginatedResponse(c, data, limit, nextCursor);
});

/**
 * GET /notifications/unread-count — Get count of unread notifications
 */
notifications.get('/unread-count', async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(inAppNotifications)
    .where(and(
      eq(inAppNotifications.user_id, user.sub),
      eq(inAppNotifications.read, 0),
    ))
    .get();

  return successResponse(c, { unread_count: result?.count ?? 0 });
});

/**
 * PUT /notifications/:id/read — Mark a single notification as read
 */
notifications.put('/:id/read', async (c) => {
  const user = c.get('user');
  const notificationId = c.req.param('id');
  const db = createDbClient(c.env.DB);

  const notification = await db
    .select({ id: inAppNotifications.id })
    .from(inAppNotifications)
    .where(and(
      eq(inAppNotifications.id, notificationId),
      eq(inAppNotifications.user_id, user.sub),
    ))
    .get();

  if (!notification) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Notification not found');
  }

  await db
    .update(inAppNotifications)
    .set({ read: 1, read_at: new Date().toISOString() })
    .where(eq(inAppNotifications.id, notificationId));

  return noContentResponse(c);
});

/**
 * PUT /notifications/read-all — Mark all notifications as read
 */
notifications.put('/read-all', async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  await db
    .update(inAppNotifications)
    .set({ read: 1, read_at: new Date().toISOString() })
    .where(and(
      eq(inAppNotifications.user_id, user.sub),
      eq(inAppNotifications.read, 0),
    ));

  return noContentResponse(c);
});

/**
 * DELETE /notifications/:id — Dismiss (delete) a single notification
 */
notifications.delete('/:id', async (c) => {
  const user = c.get('user');
  const notificationId = c.req.param('id');
  const db = createDbClient(c.env.DB);

  const notification = await db
    .select({ id: inAppNotifications.id })
    .from(inAppNotifications)
    .where(and(
      eq(inAppNotifications.id, notificationId),
      eq(inAppNotifications.user_id, user.sub),
    ))
    .get();

  if (!notification) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Notification not found');
  }

  await db
    .delete(inAppNotifications)
    .where(eq(inAppNotifications.id, notificationId));

  return noContentResponse(c);
});

export default notifications;
