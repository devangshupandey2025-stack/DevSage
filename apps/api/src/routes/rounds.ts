import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql, desc } from 'drizzle-orm';
import { createDbClient, hackathonRounds } from '@devsage/db';
import { CreateRoundRequestSchema, UpdateRoundRequestSchema, TransitionRoundStatusSchema } from '@devsage/shared';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonMiddleware } from '../middleware/hackathon.js';
import { requireRole } from '../middleware/role.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';

const rounds = new Hono<AuthAppEnv>();

rounds.use('*', authMiddleware);
rounds.use('/:slug/*', hackathonMiddleware);

/** Valid round status transitions: forward-only */
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['active'],
  active: ['judging'],
  judging: ['completed'],
  completed: [],
};

/**
 * GET /:slug/rounds — list all rounds for a hackathon
 */
rounds.get('/:slug/rounds', requireRole('team_member'), async (c) => {
  const hackathon = c.get('hackathon');
  const db = createDbClient(c.env.DB);

  const data = await db
    .select()
    .from(hackathonRounds)
    .where(eq(hackathonRounds.hackathon_id, hackathon.id))
    .orderBy(hackathonRounds.round_number)
    .all();

  return successResponse(c, data);
});

/**
 * POST /:slug/rounds — create a new round
 */
rounds.post(
  '/:slug/rounds',
  requireRole('co_organizer'),
  zValidator('json', CreateRoundRequestSchema),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    // Get next round number
    const maxResult = await db
      .select({ maxNum: sql<number>`COALESCE(MAX(round_number), 0)` })
      .from(hackathonRounds)
      .where(eq(hackathonRounds.hackathon_id, hackathon.id))
      .get();

    const nextNumber = (maxResult?.maxNum ?? 0) + 1;
    const roundId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(hackathonRounds).values({
      id: roundId,
      hackathon_id: hackathon.id,
      round_number: nextNumber,
      name: body.name,
      type: body.type,
      submission_deadline: body.submissionDeadline ?? null,
      created_at: now,
      updated_at: now,
    });

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'round.create',
      entityType: 'hackathon_round',
      entityId: roundId,
      metadata: { name: body.name, roundNumber: nextNumber, type: body.type },
    });

    const created = await db
      .select()
      .from(hackathonRounds)
      .where(eq(hackathonRounds.id, roundId))
      .get();

    return successResponse(c, created, undefined, 201);
  },
);

/**
 * GET /:slug/rounds/:roundId — get a single round
 */
rounds.get('/:slug/rounds/:roundId', requireRole('team_member'), async (c) => {
  const hackathon = c.get('hackathon');
  const roundId = c.req.param('roundId');
  const db = createDbClient(c.env.DB);

  const round = await db
    .select()
    .from(hackathonRounds)
    .where(and(eq(hackathonRounds.id, roundId), eq(hackathonRounds.hackathon_id, hackathon.id)))
    .get();

  if (!round) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Round not found');
  }

  return successResponse(c, round);
});

/**
 * PUT /:slug/rounds/:roundId — update a round
 */
rounds.put(
  '/:slug/rounds/:roundId',
  requireRole('co_organizer'),
  zValidator('json', UpdateRoundRequestSchema),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const roundId = c.req.param('roundId');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    const existing = await db
      .select()
      .from(hackathonRounds)
      .where(and(eq(hackathonRounds.id, roundId), eq(hackathonRounds.hackathon_id, hackathon.id)))
      .get();

    if (!existing) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Round not found');
    }

    const now = new Date().toISOString();

    await db
      .update(hackathonRounds)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.submissionDeadline !== undefined && { submission_deadline: body.submissionDeadline }),
        updated_at: now,
      })
      .where(eq(hackathonRounds.id, roundId));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'round.update',
      entityType: 'hackathon_round',
      entityId: roundId,
      metadata: body,
    });

    const updated = await db
      .select()
      .from(hackathonRounds)
      .where(eq(hackathonRounds.id, roundId))
      .get();

    return successResponse(c, updated);
  },
);

/**
 * DELETE /:slug/rounds/:roundId — delete a round (only if pending)
 */
rounds.delete('/:slug/rounds/:roundId', requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon');
  const user = c.get('user');
  const roundId = c.req.param('roundId');
  const db = createDbClient(c.env.DB);

  const existing = await db
    .select()
    .from(hackathonRounds)
    .where(and(eq(hackathonRounds.id, roundId), eq(hackathonRounds.hackathon_id, hackathon.id)))
    .get();

  if (!existing) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Round not found');
  }

  if (existing.status !== 'pending') {
    return errorResponse(c, 400, 'INVALID_STATUS', 'Can only delete rounds in pending status');
  }

  await db.delete(hackathonRounds).where(eq(hackathonRounds.id, roundId));

  await insertAuditEvent(db, {
    hackathonId: hackathon.id,
    actorId: user.sub,
    actorType: 'user',
    eventType: 'round.delete',
    entityType: 'hackathon_round',
    entityId: roundId,
    metadata: { name: existing.name, roundNumber: existing.round_number },
  });

  return successResponse(c, { deleted: true });
});

/**
 * PATCH /:slug/rounds/:roundId/status — transition round status
 */
rounds.patch(
  '/:slug/rounds/:roundId/status',
  requireRole('co_organizer'),
  zValidator('json', TransitionRoundStatusSchema),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const roundId = c.req.param('roundId');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    const existing = await db
      .select()
      .from(hackathonRounds)
      .where(and(eq(hackathonRounds.id, roundId), eq(hackathonRounds.hackathon_id, hackathon.id)))
      .get();

    if (!existing) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Round not found');
    }

    const allowedTransitions = VALID_TRANSITIONS[existing.status] ?? [];
    if (!allowedTransitions.includes(body.status)) {
      return errorResponse(
        c,
        400,
        'INVALID_TRANSITION',
        `Cannot transition from '${existing.status}' to '${body.status}'. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
      );
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: body.status,
      updated_at: now,
    };

    if (body.status === 'active') {
      updates.started_at = now;
    } else if (body.status === 'completed') {
      updates.completed_at = now;
    }

    await db
      .update(hackathonRounds)
      .set(updates)
      .where(eq(hackathonRounds.id, roundId));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'round.transition',
      entityType: 'hackathon_round',
      entityId: roundId,
      metadata: { from: existing.status, to: body.status },
    });

    const updated = await db
      .select()
      .from(hackathonRounds)
      .where(eq(hackathonRounds.id, roundId))
      .get();

    return successResponse(c, updated);
  },
);

export { rounds };
