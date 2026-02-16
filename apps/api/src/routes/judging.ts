import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql } from 'drizzle-orm';
import { createDbClient, judges, users, rubricCriteria, judgeAssignments, scores, hackathons, submissions, teams } from '@devsage/db';
import { InviteJudgeRequestSchema, RespondToJudgeInviteRequestSchema, BulkRubricRequestSchema, SubmitScoreRequestSchema, PaginationQuerySchema } from '@devsage/shared';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { buildJudgeAssignments, validateScoreSubmission, getLeaderboard } from '../services/judging-service.js';

const judging = new Hono<AuthAppEnv>();

judging.post(
  '/:slug/judges',
  authMiddleware,
  requireRole('co_organizer'),
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
      invited_by: user.sub,
      invited_at: now,
    });

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'judge.invite',
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

judging.get(
  '/:slug/judges',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const db = createDbClient(c.env.DB);

    const judgeList = await db
      .select({
        id: judges.id,
        hackathon_id: judges.hackathon_id,
        user_id: judges.user_id,
        invite_status: judges.invite_status,
        invited_by: judges.invited_by,
        invited_at: judges.invited_at,
        responded_at: judges.responded_at,
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

    await db
      .update(judges)
      .set({
        invite_status: newStatus,
        responded_at: now,
      })
      .where(eq(judges.id, judgeRecordId));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: body.accept ? 'judge.accept' : 'judge.decline',
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

judging.post(
  '/:slug/rubric',
  authMiddleware,
  requireRole('co_organizer'),
  zValidator('json', BulkRubricRequestSchema),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    if (hackathon.status !== 'draft') {
      return errorResponse(c, 400, 'INVALID_STATUS', 'Can only update rubric when hackathon is in draft');
    }

    await db
      .delete(rubricCriteria)
      .where(eq(rubricCriteria.hackathon_id, hackathon.id));

    const now = new Date().toISOString();
    const newCriteria = body.criteria.map((_c) => ({
      id: crypto.randomUUID(),
      hackathon_id: hackathon.id,
      name: _c.name,
      description: _c.description || '',
      max_score: _c.maxScore,
      weight: _c.weight,
      sort_order: _c.sortOrder,
      created_at: now,
    }));

    if (newCriteria.length > 0) {
      await db.insert(rubricCriteria).values(newCriteria);
    }

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'rubric.bulk_update',
      entityType: 'rubric_criteria',
      entityId: hackathon.id,
      metadata: { count: newCriteria.length },
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

judging.post(
  '/:slug/judges/assign',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const db = createDbClient(c.env.DB);

    const acceptedJudges = await db
      .select()
      .from(judges)
      .where(
        and(
          eq(judges.hackathon_id, hackathon.id),
          eq(judges.invite_status, 'accepted'),
        ),
      )
      .all();

    if (acceptedJudges.length === 0) {
      return errorResponse(c, 400, 'NO_JUDGES', 'No accepted judges available for assignment');
    }

    const result = await buildJudgeAssignments(db, hackathon.id, acceptedJudges);

    if (!result) {
      return errorResponse(c, 400, 'NO_SUBMISSIONS', 'No teams with submissions to assign judges to');
    }

    if (result.assignments.length > 0) {
      await db.insert(judgeAssignments).values(result.assignments).onConflictDoNothing();
    }

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'judges.assign',
      entityType: 'judge_assignment',
      entityId: hackathon.id,
      metadata: { count: result.assignments.length },
    });

    const inserted = await db
      .select()
      .from(judgeAssignments)
      .where(eq(judgeAssignments.hackathon_id, hackathon.id))
      .all();

    return successResponse(c, inserted);
  },
);

judging.post(
  '/:slug/scores',
  authMiddleware,
  requireRole('judge'),
  zValidator('json', SubmitScoreRequestSchema),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    const validation = await validateScoreSubmission(db, hackathon.id, user.sub, body);

    if (!validation.valid) {
      return errorResponse(c, validation.status, validation.code, validation.message);
    }

    const assignment = await db
      .select({ id: judgeAssignments.id })
      .from(judgeAssignments)
      .where(
        and(
          eq(judgeAssignments.judge_id, validation.judgeRecordId),
          eq(judgeAssignments.team_id, validation.submissionTeamId),
          eq(judgeAssignments.hackathon_id, hackathon.id),
        ),
      )
      .get();

    if (!assignment) {
      return errorResponse(c, 403, 'NO_ASSIGNMENT', 'No assignment found for this judge and team');
    }

    const scoreId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(scores).values({
      id: scoreId,
      submission_id: body.submissionId,
      judge_id: validation.judgeRecordId,
      criteria_id: body.criteriaId,
      assignment_id: assignment.id,
      score: body.score,
      comment: body.comment || null,
      scored_at: now,
    });

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'score.submit',
      entityType: 'score',
      entityId: scoreId,
      metadata: {
        submissionId: body.submissionId,
        criteriaId: body.criteriaId,
        score: body.score,
      },
    });

    const insertedScore = await db
      .select()
      .from(scores)
      .where(eq(scores.id, scoreId))
      .get();

    return successResponse(c, insertedScore);
  },
);

judging.get(
  '/:slug/leaderboard',
  optionalAuth,
  requireRole('anonymous'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const role = c.get('role');
    const db = createDbClient(c.env.DB);

    const isOrganizer = ['organizer', 'co_organizer'].includes(role);
    const isAfterJudging = ['completed', 'archived'].includes(hackathon.status);

    if (!isOrganizer && !isAfterJudging) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Leaderboard is only visible after judging is complete');
    }

    const leaderboard = await getLeaderboard(db, hackathon.id);
    return successResponse(c, leaderboard);
  },
);

/**
 * DELETE /:slug/judges/:id — remove a judge
 * Requires: co_organizer
 */
judging.delete(
  '/:slug/judges/:id',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const judgeId = c.req.param('id');
    const db = createDbClient(c.env.DB);

    const judge = await db
      .select()
      .from(judges)
      .where(and(eq(judges.id, judgeId), eq(judges.hackathon_id, hackathon.id)))
      .get();

    if (!judge) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Judge not found');
    }

    // Delete assignments first
    await db.delete(judgeAssignments).where(eq(judgeAssignments.judge_id, judgeId));
    await db.delete(judges).where(eq(judges.id, judgeId));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'judge.remove',
      entityType: 'judge',
      entityId: judgeId,
      metadata: { userId: judge.user_id },
    });

    return successResponse(c, { removed: true });
  },
);

/**
 * GET /:slug/judges/:id/assignments — get a judge's assignments
 * Requires: judge (own) or co_organizer
 */
judging.get(
  '/:slug/judges/:id/assignments',
  authMiddleware,
  requireRole('judge'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const judgeId = c.req.param('id');
    const db = createDbClient(c.env.DB);

    const judge = await db
      .select()
      .from(judges)
      .where(and(eq(judges.id, judgeId), eq(judges.hackathon_id, hackathon.id)))
      .get();

    if (!judge) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Judge not found');
    }

    const assignments = await db
      .select({
        id: judgeAssignments.id,
        teamId: judgeAssignments.team_id,
        judgeId: judgeAssignments.judge_id,
        hackathonId: judgeAssignments.hackathon_id,
        assignedAt: judgeAssignments.assigned_at,
      })
      .from(judgeAssignments)
      .where(
        and(
          eq(judgeAssignments.judge_id, judgeId),
          eq(judgeAssignments.hackathon_id, hackathon.id),
        ),
      )
      .all();

    return successResponse(c, assignments);
  },
);

/**
 * GET /:slug/scores — list all scores (organizer view)
 * Requires: co_organizer
 */
judging.get(
  '/:slug/scores',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const db = createDbClient(c.env.DB);

    const parsed = PaginationQuerySchema.safeParse({
      limit: c.req.query('limit'),
      offset: c.req.query('offset'),
    });
    const { limit, offset } = parsed.success ? parsed.data : { limit: 20, offset: 0 };

    // Get scores with submission and judge info
    const data = await db
      .select({
        id: scores.id,
        submissionId: scores.submission_id,
        judgeId: scores.judge_id,
        criteriaId: scores.criteria_id,
        score: scores.score,
        comment: scores.comment,
        isSubmitted: scores.is_submitted,
        scoredAt: scores.scored_at,
      })
      .from(scores)
      .innerJoin(submissions, eq(submissions.id, scores.submission_id))
      .innerJoin(teams, eq(teams.id, submissions.team_id))
      .where(eq(teams.hackathon_id, hackathon.id))
      .limit(limit)
      .offset(offset)
      .all();

    const totalResult = await db
      .select({ value: sql<number>`COUNT(*)` })
      .from(scores)
      .innerJoin(submissions, eq(submissions.id, scores.submission_id))
      .innerJoin(teams, eq(teams.id, submissions.team_id))
      .where(eq(teams.hackathon_id, hackathon.id))
      .get();

    return paginatedResponse(c, data, totalResult?.value ?? 0, limit, offset);
  },
);

/**
 * POST /:slug/results/publish — publish final results
 * Requires: co_organizer, hackathon must be in judging or completed status
 */
judging.post(
  '/:slug/results/publish',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const db = createDbClient(c.env.DB);

    if (!['judging', 'completed'].includes(hackathon.status)) {
      return errorResponse(c, 400, 'INVALID_STATUS', 'Results can only be published during judging or completed status');
    }

    const leaderboard = await getLeaderboard(db, hackathon.id);

    // Transition to completed if still in judging
    if (hackathon.status === 'judging') {
      const now = new Date().toISOString();
      await db
        .update(hackathons)
        .set({ status: 'completed', updated_at: now })
        .where(eq(hackathons.id, hackathon.id));
    }

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'results.publish',
      entityType: 'hackathon',
      entityId: hackathon.id,
      metadata: { teamCount: leaderboard.length },
    });

    return successResponse(c, { published: true, leaderboard });
  },
);

export default judging;


