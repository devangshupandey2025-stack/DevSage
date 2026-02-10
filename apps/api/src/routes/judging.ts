import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { createDbClient, judges, users, rubricCriteria } from '@devsage/db';
import { InviteJudgeRequestSchema, RespondToJudgeInviteRequestSchema, BulkRubricRequestSchema } from '@devsage/shared';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';

const judging = new Hono<AuthAppEnv>();

/**
 * POST /:slug/judges — invite a judge
 * Requires: admin+ role
 */
judging.post(
  '/:slug/judges',
  authMiddleware,
  requireRole('admin'),
  zValidator('json', InviteJudgeRequestSchema),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    const existing = await db
      .select()
      .from(judges)
      .where(
        and(
          eq(judges.hackathon_id, hackathon.id),
          eq(judges.user_id, body.userId),
        ),
      )
      .get();

    if (existing) {
      return errorResponse(c, 409, 'DUPLICATE_INVITE', 'Judge already invited');
    }

    const judgeId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(judges).values({
      id: judgeId,
      hackathon_id: hackathon.id,
      user_id: body.userId,
      invite_status: 'pending',
      invited_at: now,
      accepted_at: null,
    });

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'judge.invite',
      entityType: 'judge',
      entityId: judgeId,
    });

    const judge = await db
      .select()
      .from(judges)
      .where(eq(judges.id, judgeId))
      .get();

    return successResponse(c, judge);
  },
);

/**
 * GET /:slug/judges — list all judges with user details
 * Requires: admin+ role
 */
judging.get(
  '/:slug/judges',
  authMiddleware,
  requireRole('admin'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const db = createDbClient(c.env.DB);

    const judgeList = await db
      .select({
        id: judges.id,
        hackathon_id: judges.hackathon_id,
        user_id: judges.user_id,
        invite_status: judges.invite_status,
        invited_at: judges.invited_at,
        accepted_at: judges.accepted_at,
        user: {
          id: users.id,
          email: users.email,
          display_name: users.display_name,
          avatar_url: users.avatar_url,
        },
      })
      .from(judges)
      .innerJoin(users, eq(judges.user_id, users.id))
      .where(eq(judges.hackathon_id, hackathon.id))
      .all();

    return successResponse(c, judgeList);
  },
);

/**
 * POST /:slug/judges/:judgeId/respond — judge accepts or declines invite
 * Requires: authenticated user, must be the invited judge
 */
judging.post(
  '/:slug/judges/:judgeId/respond',
  authMiddleware,
  requireRole('anonymous'),
  zValidator('json', RespondToJudgeInviteRequestSchema),
  async (c) => {
    const judgeRecordId = c.req.param('judgeId');
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    const judgeRecord = await db
      .select()
      .from(judges)
      .where(
        and(
          eq(judges.id, judgeRecordId),
          eq(judges.hackathon_id, hackathon.id),
        ),
      )
      .get();

    if (!judgeRecord) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Judge invite not found');
    }

    if (judgeRecord.user_id !== user.sub) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Can only respond to your own invite');
    }

    const now = new Date().toISOString();
    const newStatus = body.accept ? 'accepted' : 'declined';
    const acceptedAt = body.accept ? now : null;

    await db
      .update(judges)
      .set({
        invite_status: newStatus,
        accepted_at: acceptedAt,
      })
      .where(eq(judges.id, judgeRecordId));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: body.accept ? 'judge.accept' : 'judge.decline',
      entityType: 'judge',
      entityId: judgeRecordId,
    });

    const updated = await db
      .select()
      .from(judges)
      .where(eq(judges.id, judgeRecordId))
      .get();

    return successResponse(c, updated);
  },
);

/**
 * GET /:slug/rubric — retrieve all rubric criteria for a hackathon, ordered by sort_order
 * Requires: anonymous (open to all)
 */
judging.get(
  '/:slug/rubric',
  optionalAuth,
  requireRole('anonymous'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const db = createDbClient(c.env.DB);

    const criteria = await db
      .select()
      .from(rubricCriteria)
      .where(eq(rubricCriteria.hackathon_id, hackathon.id))
      .orderBy(rubricCriteria.sort_order)
      .all();

    return successResponse(c, criteria);
  },
);

/**
 * POST /:slug/rubric — bulk upsert rubric criteria (delete all, insert new)
 * Requires: admin+ role
 * Status constraint: only 'draft' or 'registration_open'
 */
judging.post(
  '/:slug/rubric',
  authMiddleware,
  requireRole('admin'),
  zValidator('json', BulkRubricRequestSchema),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    if (hackathon.status !== 'draft' && hackathon.status !== 'registration_open') {
      return errorResponse(c, 400, 'INVALID_STATUS', 'Can only update rubric when hackathon is draft or registration_open');
    }

    await db
      .delete(rubricCriteria)
      .where(eq(rubricCriteria.hackathon_id, hackathon.id));

    const newCriteria = body.criteria.map((_c) => ({
      id: crypto.randomUUID(),
      hackathon_id: hackathon.id,
      name: _c.name,
      description: _c.description || null,
      max_score: _c.maxScore,
      weight: _c.weight,
      sort_order: _c.sortOrder,
    }));

    if (newCriteria.length > 0) {
      await db.insert(rubricCriteria).values(newCriteria);
    }

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'rubric.bulk_update',
      entityType: 'rubric_criteria',
      entityId: hackathon.id,
      details: { count: newCriteria.length },
    });

    const inserted = await db
      .select()
      .from(rubricCriteria)
      .where(eq(rubricCriteria.hackathon_id, hackathon.id))
      .orderBy(rubricCriteria.sort_order)
      .all();

    return successResponse(c, inserted);
  },
);

export default judging;


