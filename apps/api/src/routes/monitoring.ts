import { Hono } from 'hono';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { createDbClient, webhookDeliveries, forcePushEvents } from '@devsage/db';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonMiddleware } from '../middleware/hackathon.js';
import { requireRole } from '../middleware/role.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';

const monitoring = new Hono<AuthAppEnv>();

monitoring.use('*', authMiddleware);
monitoring.use('/:slug/*', hackathonMiddleware);

// ── Webhook Deliveries ──

/**
 * GET /:slug/webhook-deliveries — list webhook deliveries for a hackathon
 */
monitoring.get(
  '/:slug/webhook-deliveries',
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const db = createDbClient(c.env.DB);
    const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
    const offset = Number(c.req.query('offset') ?? 0);
    const statusFilter = c.req.query('status') as 'received' | 'processing' | 'processed' | 'failed' | 'dead_lettered' | undefined;

    const conditions = [eq(webhookDeliveries.hackathon_id, hackathon.id)];
    if (statusFilter) {
      conditions.push(eq(webhookDeliveries.status, statusFilter));
    }
    const whereClause = and(...conditions);

    const data = await db
      .select()
      .from(webhookDeliveries)
      .where(whereClause)
      .orderBy(desc(webhookDeliveries.received_at))
      .limit(limit)
      .offset(offset)
      .all();

    const totalResult = await db
      .select({ value: count() })
      .from(webhookDeliveries)
      .where(whereClause)
      .get();

    return paginatedResponse(c, data, totalResult?.value ?? 0, limit, offset);
  },
);

/**
 * GET /:slug/webhook-deliveries/:id — get webhook delivery details
 */
monitoring.get(
  '/:slug/webhook-deliveries/:id',
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const deliveryId = c.req.param('id');
    const db = createDbClient(c.env.DB);

    const delivery = await db
      .select()
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.hackathon_id, hackathon.id)))
      .get();

    if (!delivery) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Webhook delivery not found');
    }

    return successResponse(c, delivery);
  },
);

/**
 * POST /:slug/webhook-deliveries/:id/retry — retry a failed webhook delivery
 */
monitoring.post(
  '/:slug/webhook-deliveries/:id/retry',
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const deliveryId = c.req.param('id');
    const db = createDbClient(c.env.DB);

    const delivery = await db
      .select()
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.hackathon_id, hackathon.id)))
      .get();

    if (!delivery) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Webhook delivery not found');
    }

    if (delivery.status !== 'dead_lettered') {
      return errorResponse(c, 400, 'INVALID_STATUS', 'Only dead-lettered deliveries can be retried');
    }

    // Reset status for reprocessing
    const now = new Date().toISOString();
    await db
      .update(webhookDeliveries)
      .set({ status: 'received' as const, retry_count: 0, processed_at: now })
      .where(eq(webhookDeliveries.id, deliveryId));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'webhook.retry',
      entityType: 'webhook_delivery',
      entityId: deliveryId,
    });

    return successResponse(c, { retried: true });
  },
);

// ── Force Push Events ──

/**
 * GET /:slug/force-pushes — list force push events
 */
monitoring.get(
  '/:slug/force-pushes',
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const db = createDbClient(c.env.DB);
    const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
    const offset = Number(c.req.query('offset') ?? 0);

    const data = await db
      .select()
      .from(forcePushEvents)
      .where(eq(forcePushEvents.hackathon_id, hackathon.id))
      .orderBy(desc(forcePushEvents.created_at))
      .limit(limit)
      .offset(offset)
      .all();

    const totalResult = await db
      .select({ value: count() })
      .from(forcePushEvents)
      .where(eq(forcePushEvents.hackathon_id, hackathon.id))
      .get();

    return paginatedResponse(c, data, totalResult?.value ?? 0, limit, offset);
  },
);

/**
 * PUT /:slug/force-pushes/:id/resolve — mark a force push as reviewed/resolved
 */
monitoring.put(
  '/:slug/force-pushes/:id/resolve',
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const eventId = c.req.param('id');
    const db = createDbClient(c.env.DB);

    const body = await c.req.json<{ note?: string }>().catch(() => ({ note: undefined as string | undefined }));

    const event = await db
      .select()
      .from(forcePushEvents)
      .where(and(eq(forcePushEvents.id, eventId), eq(forcePushEvents.hackathon_id, hackathon.id)))
      .get();

    if (!event) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Force push event not found');
    }

    if (event.resolved_at) {
      return errorResponse(c, 400, 'ALREADY_RESOLVED', 'This force push event is already resolved');
    }

    const now = new Date().toISOString();
    await db
      .update(forcePushEvents)
      .set({
        resolved_by: user.sub,
        resolved_at: now,
        resolution_note: body.note ?? null,
      })
      .where(eq(forcePushEvents.id, eventId));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'force_push.resolve',
      entityType: 'force_push_event',
      entityId: eventId,
      metadata: { note: body.note },
    });

    return successResponse(c, { resolved: true });
  },
);

export { monitoring };
