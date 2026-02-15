import { Hono } from 'hono';
import { eq, and, desc, lt, sql } from 'drizzle-orm';
import { createDbClient, auditEvents } from '@devsage/db';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { successResponse, errorResponse, cursorPaginatedResponse } from '../lib/response.js';

const audit = new Hono<AuthAppEnv>();

/**
 * GET /:slug/audit — Query audit trail for a hackathon (cursor-paginated)
 * Requires co_organizer role. Cursor is based on created_at.
 * Query params: limit (1-100, default 20), cursor (ISO timestamp), action, entity_type, entity_id, actor_id
 */
audit.get(
  '/:slug/audit',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const db = createDbClient(c.env.DB);

    const limitParam = c.req.query('limit');
    const cursor = c.req.query('cursor');
    const actionFilter = c.req.query('action');
    const entityTypeFilter = c.req.query('entity_type');
    const entityIdFilter = c.req.query('entity_id');
    const actorIdFilter = c.req.query('actor_id');

    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100);

    const conditions: ReturnType<typeof eq>[] = [sql`${auditEvents.hackathon_id} = ${hackathon.id}`];
    if (cursor) {
      conditions.push(lt(auditEvents.created_at, cursor));
    }
    if (actionFilter) {
      conditions.push(eq(auditEvents.action, actionFilter));
    }
    if (entityTypeFilter) {
      conditions.push(eq(auditEvents.entity_type, entityTypeFilter));
    }
    if (entityIdFilter) {
      conditions.push(eq(auditEvents.entity_id, entityIdFilter));
    }
    if (actorIdFilter) {
      conditions.push(sql`${auditEvents.actor_id} = ${actorIdFilter}`);
    }

    const rows = await db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.created_at))
      .limit(limit + 1)
      .all();

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && data.length > 0
      ? data[data.length - 1].created_at
      : null;

    return cursorPaginatedResponse(c, data, limit, nextCursor);
  },
);

/**
 * GET /:slug/audit/:eventId — Get a single audit event
 */
audit.get(
  '/:slug/audit/:eventId',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const eventId = c.req.param('eventId');
    const db = createDbClient(c.env.DB);

    const event = await db
      .select()
      .from(auditEvents)
      .where(and(
        eq(auditEvents.id, eventId),
        sql`${auditEvents.hackathon_id} = ${hackathon.id}`,
      ))
      .get();

    if (!event) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Audit event not found');
    }

    return successResponse(c, event);
  },
);

/**
 * GET /:slug/audit/entity/:type/:entityId — Get audit events for a specific entity
 */
audit.get(
  '/:slug/audit/entity/:type/:entityId',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const entityType = c.req.param('type');
    const entityId = c.req.param('entityId');
    const db = createDbClient(c.env.DB);

    const limitParam = c.req.query('limit');
    const cursor = c.req.query('cursor');
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100);

    const conditions: ReturnType<typeof eq>[] = [
      sql`${auditEvents.hackathon_id} = ${hackathon.id}`,
      eq(auditEvents.entity_type, entityType),
      eq(auditEvents.entity_id, entityId),
    ];
    if (cursor) {
      conditions.push(lt(auditEvents.created_at, cursor));
    }

    const rows = await db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.created_at))
      .limit(limit + 1)
      .all();

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && data.length > 0
      ? data[data.length - 1].created_at
      : null;

    return cursorPaginatedResponse(c, data, limit, nextCursor);
  },
);

/**
 * GET /:slug/audit/actor/:actorId — Get audit events by a specific actor
 */
audit.get(
  '/:slug/audit/actor/:actorId',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const actorId = c.req.param('actorId');
    const db = createDbClient(c.env.DB);

    const limitParam = c.req.query('limit');
    const cursor = c.req.query('cursor');
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100);

    const conditions: ReturnType<typeof eq>[] = [
      sql`${auditEvents.hackathon_id} = ${hackathon.id}`,
      sql`${auditEvents.actor_id} = ${actorId}`,
    ];
    if (cursor) {
      conditions.push(lt(auditEvents.created_at, cursor));
    }

    const rows = await db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.created_at))
      .limit(limit + 1)
      .all();

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && data.length > 0
      ? data[data.length - 1].created_at
      : null;

    return cursorPaginatedResponse(c, data, limit, nextCursor);
  },
);

export default audit;
