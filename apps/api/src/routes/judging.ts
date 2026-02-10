import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
import { createDbClient, judges, users, rubricCriteria, judgeAssignments, teams, submissions } from '@devsage/db';
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

/**
 * POST /:slug/judges/assign — auto-assign judges to teams with submissions (round-robin)
 * Requires: admin+ role
 */
judging.post(
  '/:slug/judges/assign',
  authMiddleware,
  requireRole('admin'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const db = createDbClient(c.env.DB);

    // Get all accepted judges for this hackathon
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

    // Get all teams with at least one submission
    // Prefer is_final=1, else latest by submitted_at
    const teamsWithSubmissions = await db
      .select({
        teamId: teams.id,
        submissionId: submissions.id,
        isFinal: submissions.is_final,
        submittedAt: submissions.submitted_at,
      })
      .from(teams)
      .innerJoin(submissions, eq(submissions.team_id, teams.id))
      .where(
        and(
          eq(teams.hackathon_id, hackathon.id),
          eq(submissions.hackathon_id, hackathon.id),
        ),
      )
      .all();

    if (teamsWithSubmissions.length === 0) {
      return errorResponse(c, 400, 'NO_SUBMISSIONS', 'No teams with submissions to assign judges to');
    }

    // Group by team and pick the final submission or the latest one
    const teamSubmissionMap = new Map<string, string>();
    const teamData = new Map<string, { teamId: string; submissionId: string; isFinal: number; submittedAt: string }>();

    for (const row of teamsWithSubmissions) {
      const existing = teamData.get(row.teamId);
      if (!existing) {
        teamData.set(row.teamId, row);
      } else {
        // Prefer is_final=1, else latest by submitted_at
        if (row.isFinal === 1 && existing.isFinal === 0) {
          teamData.set(row.teamId, row);
        } else if (row.isFinal === existing.isFinal && row.submittedAt > existing.submittedAt) {
          teamData.set(row.teamId, row);
        }
      }
    }

    for (const [teamId, data] of teamData) {
      teamSubmissionMap.set(teamId, data.submissionId);
    }

    const teamIds = Array.from(teamSubmissionMap.keys());

    // Round-robin assignment: each team gets min(3, judges.length) judges
    const reviewsPerTeam = Math.min(3, acceptedJudges.length);
    const assignmentRecords: Array<{
      id: string;
      judge_id: string;
      team_id: string;
      hackathon_id: string;
      submission_id: string;
      status: 'pending';
      assigned_at: string;
    }> = [];

    const now = new Date().toISOString();

    for (let i = 0; i < teamIds.length; i++) {
      const teamId = teamIds[i];
      const submissionId = teamSubmissionMap.get(teamId);

      if (!submissionId) continue;

      for (let j = 0; j < reviewsPerTeam; j++) {
        const judgeIndex = (i + j) % acceptedJudges.length;
        assignmentRecords.push({
          id: crypto.randomUUID(),
          judge_id: acceptedJudges[judgeIndex].id,
          team_id: teamId,
          hackathon_id: hackathon.id,
          submission_id: submissionId,
          status: 'pending',
          assigned_at: now,
        });
      }
    }

    // Insert assignments (INSERT OR IGNORE handles duplicates via UNIQUE constraint on judge_id + team_id)
    if (assignmentRecords.length > 0) {
      await db.insert(judgeAssignments).values(assignmentRecords).onConflictDoNothing();
    }

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'judges.assign',
      entityType: 'judge_assignment',
      entityId: hackathon.id,
      details: { count: assignmentRecords.length },
    });

    const inserted = await db
      .select()
      .from(judgeAssignments)
      .where(eq(judgeAssignments.hackathon_id, hackathon.id))
      .all();

    return successResponse(c, inserted);
  },
);

export default judging;


