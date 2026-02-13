/**
 * Judging business logic extracted from routes/judging.ts.
 *
 * Contains: round-robin judge assignment, score validation, leaderboard query.
 * Route handlers remain thin — they call these functions and format responses.
 */

import type { DbClient } from '@devsage/db';
import { judges, teams, submissions, judgeAssignments, rubricCriteria, scores } from '@devsage/db';
import { eq, and, sql } from 'drizzle-orm';
import { REVIEWS_PER_TEAM } from '../lib/constants.js';

// ─── Types ───────────────────────────────────────────────────

interface AssignmentRecord {
  id: string;
  judge_id: string;
  team_id: string;
  hackathon_id: string;
  submission_id: string;
  status: 'pending';
  assigned_at: string;
}

export interface AssignmentResult {
  assignments: AssignmentRecord[];
  teamCount: number;
}

export interface ScoreValidationSuccess {
  valid: true;
  judgeRecordId: string;
  submissionTeamId: string;
}

export interface ScoreValidationFailure {
  valid: false;
  status: number;
  code: string;
  message: string;
}

export type ScoreValidationResult = ScoreValidationSuccess | ScoreValidationFailure;

interface LeaderboardEntry {
  team_id: string;
  team_name: string;
  weighted_percentage: number;
  judges_completed: number;
}

// ─── Round-Robin Assignment ──────────────────────────────────

/**
 * Pick the best submission per team: prefer is_final=1, else latest by submitted_at.
 * Returns a Map of teamId → submissionId.
 */
function pickBestSubmissions(
  rows: Array<{ teamId: string; submissionId: string; isFinal: number; submittedAt: string }>,
): Map<string, string> {
  const best = new Map<string, { submissionId: string; isFinal: number; submittedAt: string }>();

  for (const row of rows) {
    const existing = best.get(row.teamId);
    if (!existing) {
      best.set(row.teamId, { submissionId: row.submissionId, isFinal: row.isFinal, submittedAt: row.submittedAt });
    } else if (row.isFinal === 1 && existing.isFinal === 0) {
      best.set(row.teamId, { submissionId: row.submissionId, isFinal: row.isFinal, submittedAt: row.submittedAt });
    } else if (row.isFinal === existing.isFinal && row.submittedAt > existing.submittedAt) {
      best.set(row.teamId, { submissionId: row.submissionId, isFinal: row.isFinal, submittedAt: row.submittedAt });
    }
  }

  const result = new Map<string, string>();
  for (const [teamId, data] of best) {
    result.set(teamId, data.submissionId);
  }
  return result;
}

/**
 * Build round-robin judge assignments for all teams with submissions.
 *
 * Each team gets `min(REVIEWS_PER_TEAM, acceptedJudges.length)` judges.
 * Returns the assignment records (not yet inserted) and team count.
 *
 * Returns `null` if no teams have submissions.
 */
export async function buildJudgeAssignments(
  db: DbClient,
  hackathonId: string,
  acceptedJudges: Array<{ id: string }>,
): Promise<AssignmentResult | null> {
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
        eq(teams.hackathon_id, hackathonId),
        eq(submissions.hackathon_id, hackathonId),
      ),
    )
    .all();

  if (teamsWithSubmissions.length === 0) {
    return null;
  }

  const teamSubmissionMap = pickBestSubmissions(teamsWithSubmissions);
  const teamIds = Array.from(teamSubmissionMap.keys());
  const reviewsPerTeam = Math.min(REVIEWS_PER_TEAM, acceptedJudges.length);
  const now = new Date().toISOString();

  const assignmentRecords: AssignmentRecord[] = [];

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
        hackathon_id: hackathonId,
        submission_id: submissionId,
        status: 'pending',
        assigned_at: now,
      });
    }
  }

  return { assignments: assignmentRecords, teamCount: teamIds.length };
}

// ─── Score Validation ────────────────────────────────────────

/**
 * Validate all preconditions for submitting a score.
 *
 * Checks (in order):
 * 1. User is an accepted judge for this hackathon
 * 2. Criteria exists for this hackathon
 * 3. Score does not exceed max_score
 * 4. Submission exists for this hackathon
 * 5. Judge is assigned to the team owning this submission
 * 6. No duplicate score exists
 *
 * Returns `{ valid: true, ... }` with the judge record ID and submission team ID,
 * or `{ valid: false, status, code, message }` on the first failure.
 */
export async function validateScoreSubmission(
  db: DbClient,
  hackathonId: string,
  userId: string,
  body: { submissionId: string; criteriaId: string; score: number },
): Promise<ScoreValidationResult> {
  // 1. Find the judge record
  const judgeRecord = await db
    .select()
    .from(judges)
    .where(
      and(
        eq(judges.hackathon_id, hackathonId),
        eq(judges.user_id, userId),
        eq(judges.invite_status, 'accepted'),
      ),
    )
    .get();

  if (!judgeRecord) {
    return { valid: false, status: 403, code: 'NOT_JUDGE', message: 'You are not an accepted judge for this hackathon' };
  }

  // 2. Look up criteria
  const criteria = await db
    .select()
    .from(rubricCriteria)
    .where(
      and(
        eq(rubricCriteria.id, body.criteriaId),
        eq(rubricCriteria.hackathon_id, hackathonId),
      ),
    )
    .get();

  if (!criteria) {
    return { valid: false, status: 404, code: 'CRITERIA_NOT_FOUND', message: 'Criteria not found' };
  }

  // 3. Validate score range
  if (body.score > criteria.max_score) {
    return { valid: false, status: 400, code: 'SCORE_TOO_HIGH', message: `Score must not exceed ${criteria.max_score}` };
  }

  // 4. Look up submission
  const submission = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.id, body.submissionId),
        eq(submissions.hackathon_id, hackathonId),
      ),
    )
    .get();

  if (!submission) {
    return { valid: false, status: 404, code: 'SUBMISSION_NOT_FOUND', message: 'Submission not found' };
  }

  // 5. Check judge is assigned to this team
  const assignment = await db
    .select()
    .from(judgeAssignments)
    .where(
      and(
        eq(judgeAssignments.judge_id, judgeRecord.id),
        eq(judgeAssignments.team_id, submission.team_id),
        eq(judgeAssignments.hackathon_id, hackathonId),
      ),
    )
    .get();

  if (!assignment) {
    return { valid: false, status: 403, code: 'NOT_ASSIGNED', message: 'You are not assigned to judge this team' };
  }

  // 6. Check for duplicate score
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
    return { valid: false, status: 409, code: 'DUPLICATE_SCORE', message: 'Score already submitted for this submission and criteria' };
  }

  return { valid: true, judgeRecordId: judgeRecord.id, submissionTeamId: submission.team_id };
}

// ─── Leaderboard ─────────────────────────────────────────────

/**
 * Compute the weighted leaderboard for a hackathon.
 *
 * Formula: SUM(score * weight) / SUM(max_score * weight) * 100
 * Only considers final submissions (is_final = 1).
 * Results ordered by weighted percentage descending.
 */
export async function getLeaderboard(
  db: DbClient,
  hackathonId: string,
): Promise<LeaderboardEntry[]> {
  return db
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
        eq(submissions.hackathon_id, hackathonId),
        eq(submissions.is_final, 1),
      ),
    )
    .groupBy(teams.id)
    .orderBy(sql`ROUND(SUM(${scores.score} * ${rubricCriteria.weight}) / SUM(${rubricCriteria.max_score} * ${rubricCriteria.weight}) * 100, 2) DESC`)
    .all();
}
