import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql } from 'drizzle-orm';
import { createDbClient, judges, users, rubricCriteria, judgeAssignments, teams, submissions, scores } from '@devsage/db';
import { InviteJudgeRequestSchema, RespondToJudgeInviteRequestSchema, BulkRubricRequestSchema, SubmitScoreRequestSchema } from '@devsage/shared';
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

/**
 * POST /:slug/scores — judge submits a score for a submission+criteria pair
 * Requires: authenticated judge, must be assigned to the team that owns the submission
 * Write-once: UNIQUE(submission_id, judge_id, criteria_id) → 409 on duplicate
 */
judging.post(
  '/:slug/scores',
  authMiddleware,
  requireRole('anonymous'),
  zValidator('json', SubmitScoreRequestSchema),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    // 1. Find the judge record for this user
    const judgeRecord = await db
      .select()
      .from(judges)
      .where(
        and(
          eq(judges.hackathon_id, hackathon.id),
          eq(judges.user_id, user.sub),
          eq(judges.invite_status, 'accepted'),
        ),
      )
      .get();

    if (!judgeRecord) {
      return errorResponse(c, 403, 'NOT_JUDGE', 'You are not an accepted judge for this hackathon');
    }

    // 2. Look up the criteria to get max_score
    const criteria = await db
      .select()
      .from(rubricCriteria)
      .where(
        and(
          eq(rubricCriteria.id, body.criteriaId),
          eq(rubricCriteria.hackathon_id, hackathon.id),
        ),
      )
      .get();

    if (!criteria) {
      return errorResponse(c, 404, 'CRITERIA_NOT_FOUND', 'Criteria not found');
    }

    // 3. Validate score range
    if (body.score > criteria.max_score) {
      return errorResponse(c, 400, 'SCORE_TOO_HIGH', `Score must not exceed ${criteria.max_score}`);
    }

    // 4. Look up the submission
    const submission = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.id, body.submissionId),
          eq(submissions.hackathon_id, hackathon.id),
        ),
      )
      .get();

    if (!submission) {
      return errorResponse(c, 404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
    }

    // 5. Check that this judge is assigned to the team that owns this submission
    const assignment = await db
      .select()
      .from(judgeAssignments)
      .where(
        and(
          eq(judgeAssignments.judge_id, judgeRecord.id),
          eq(judgeAssignments.team_id, submission.team_id),
          eq(judgeAssignments.hackathon_id, hackathon.id),
        ),
      )
      .get();

    if (!assignment) {
      return errorResponse(c, 403, 'NOT_ASSIGNED', 'You are not assigned to judge this team');
    }

    // 6. Check for existing score (UNIQUE constraint: submission_id, judge_id, criteria_id)
    const existingScore = await db
      .select()
      .from(scores)
      .where(
        and(
          eq(scores.submission_id, body.submissionId),
          eq(scores.judge_id, judgeRecord.id),
          eq(scores.criteria_id, body.criteriaId),
        ),
      )
      .get();

    if (existingScore) {
      return errorResponse(c, 409, 'DUPLICATE_SCORE', 'Score already submitted for this submission and criteria');
    }

    // 7. Insert the score
    const scoreId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(scores).values({
      id: scoreId,
      submission_id: body.submissionId,
      judge_id: judgeRecord.id,
      criteria_id: body.criteriaId,
      score: body.score,
      comment: body.comment || null,
      scored_at: now,
    });

    // 8. Audit event
    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'score.submit',
      entityType: 'score',
      entityId: scoreId,
      details: {
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

/**
 * GET /:slug/leaderboard — aggregated weighted scoring results
 * Requires: anonymous (open to all after judging complete, admin+ anytime)
 */
judging.get(
  '/:slug/leaderboard',
  optionalAuth,
  requireRole('anonymous'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const role = c.get('role');
    const db = createDbClient(c.env.DB);

    // Visibility check: organizers can view anytime, others only after judging complete
    const isOrganizer = ['owner', 'admin', 'moderator'].includes(role);
    const isAfterJudging = ['completed', 'archived'].includes(hackathon.status);

    if (!isOrganizer && !isAfterJudging) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Leaderboard is only visible after judging is complete');
    }

    // Query weighted scoring results using Drizzle ORM
    // Formula: SUM(score * weight) / SUM(max_score * weight) * 100
    const leaderboard = await db
      .select({
        team_id: teams.id,
        team_name: teams.name,
        weighted_percentage: sql<number>`ROUND(SUM(${scores.score} * ${rubricCriteria.weight}) / SUM(${rubricCriteria.max_score} * ${rubricCriteria.weight}) * 100, 2)`,
        judges_completed: sql<number>`COUNT(DISTINCT ${scores.judge_id})`,
      })
      .from(scores)
      .innerJoin(rubricCriteria, eq(scores.criteria_id, rubricCriteria.id))
      .innerJoin(submissions, eq(scores.submission_id, submissions.id))
      .innerJoin(teams, eq(submissions.team_id, teams.id))
      .where(
        and(
          eq(submissions.hackathon_id, hackathon.id),
          eq(submissions.is_final, 1),
        ),
      )
      .groupBy(teams.id)
      .orderBy(sql`ROUND(SUM(${scores.score} * ${rubricCriteria.weight}) / SUM(${rubricCriteria.max_score} * ${rubricCriteria.weight}) * 100, 2) DESC`)
      .all();

    return successResponse(c, leaderboard);
  },
);

export default judging;


