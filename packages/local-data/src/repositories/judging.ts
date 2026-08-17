/**
 * Judging repository — judges, rubrics, assignments, conflicts, scores,
 * deterministic leaderboard.
 */

import { db } from "../db/database.js";
import type {
  ConflictRecord,
  JudgeAssignmentRecord,
  JudgeRecord,
  RubricCriterionRecord,
  ScoreRecord,
  SubmissionRecord,
  TeamRecord,
  UserRecord,
} from "../db/schema.js";
import { now, uuid } from "../lib/utils.js";
import { usersRepository } from "./users.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JudgeWithUser extends JudgeRecord {
  user: Pick<UserRecord, "id" | "name" | "email" | "avatar_url"> | null;
}

export interface AssignmentWithDetails extends JudgeAssignmentRecord {
  team: Pick<TeamRecord, "id" | "name"> | null;
  submission: Pick<SubmissionRecord, "id" | "tag_name" | "commit_sha" | "submitted_at"> | null;
  judge_name: string | null;
  scores?: ScoreRecord[];
}

export interface LeaderboardBreakdown {
  criterion_id: string;
  name: string;
  max_score: number;
  weight: number;
  average: number;
  weighted: number;
}

export interface LeaderboardEntry {
  rank: number;
  team_id: string;
  team_name: string;
  submission_id: string | null;
  round: number;
  total: number;
  breakdown: LeaderboardBreakdown[];
}

export interface SubmitScoreInput {
  criterion_id: string;
  score: number;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Scoring math (shared with rounds.publishResults)
// ---------------------------------------------------------------------------

export function computeLeaderboardEntry(
  teamName: string,
  submissionId: string,
  scores: ScoreRecord[],
  rubric: RubricCriterionRecord[],
): Omit<LeaderboardEntry, "rank"> {
  const breakdown: LeaderboardBreakdown[] = rubric.map((criterion) => {
    const criterionScores = scores.filter((s) => s.criterion_id === criterion.id);
    const average =
      criterionScores.length > 0
        ? criterionScores.reduce((sum, s) => sum + s.score, 0) / criterionScores.length
        : 0;
    const weighted = criterion.max_score > 0 ? (average / criterion.max_score) * criterion.weight : 0;
    return {
      criterion_id: criterion.id,
      name: criterion.name,
      max_score: criterion.max_score,
      weight: criterion.weight,
      average,
      weighted,
    };
  });
  const total = breakdown.reduce((sum, b) => sum + b.weighted * 100, 0);
  return { team_id: "", team_name: teamName, submission_id: submissionId, round: 0, total, breakdown };
}

/**
 * Deterministic leaderboard for a hackathon round.
 * Ranked by weighted total (descending); ties broken by team name, then team id.
 */
export async function computeLeaderboard(
  hackathonId: string,
  roundNumber?: number,
): Promise<LeaderboardEntry[]> {
  const [rounds, rubric, submissions, teams, allScores] = await Promise.all([
    db.rounds.where("hackathon_id").equals(hackathonId).toArray(),
    db.rubrics.where("hackathon_id").equals(hackathonId).toArray(),
    db.submissions.where("hackathon_id").equals(hackathonId).toArray(),
    db.teams.where("hackathon_id").equals(hackathonId).toArray(),
    db.scores.toArray(),
  ]);

  const targetRound =
    roundNumber ?? [...rounds].sort((a, b) => b.round_number - a.round_number)[0]?.round_number ?? 1;

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const roundIds = new Set(rounds.filter((r) => r.round_number === targetRound).map((r) => r.id));

  const entries: Omit<LeaderboardEntry, "rank">[] = [];
  for (const submission of submissions) {
    if (submission.round_id && !roundIds.has(submission.round_id)) continue;
    if (submission.is_current !== 1) continue;
    const roundScores = allScores.filter((s) => s.submission_id === submission.id && s.round === targetRound);
    if (roundScores.length === 0) continue;
    const team = teamById.get(submission.team_id);
    const entry = computeLeaderboardEntry(
      team?.name ?? "Unknown Team",
      submission.id,
      roundScores,
      [...rubric].sort((a, b) => a.sort_order - b.sort_order),
    );
    entry.team_id = submission.team_id;
    entry.round = targetRound;
    entries.push(entry);
  }

  entries.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.team_name !== b.team_name) return a.team_name.localeCompare(b.team_name);
    return a.team_id.localeCompare(b.team_id);
  });

  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const judgingRepository = {
  // -------------------------------------------------------------------------
  // Judges
  // -------------------------------------------------------------------------

  async listJudges(hackathonId: string): Promise<JudgeWithUser[]> {
    const rows = await db.judges.where("hackathon_id").equals(hackathonId).toArray();
    return Promise.all(
      rows.map(async (row) => {
        const user = await db.users.get(row.user_id);
        return {
          ...row,
          user: user
            ? { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url }
            : null,
        };
      }),
    );
  },

  async getJudge(hackathonId: string, userId: string): Promise<JudgeRecord | undefined> {
    return db.judges
      .where("hackathon_id")
      .equals(hackathonId)
      .and((j) => j.user_id === userId)
      .first();
  },

  async getJudgeById(id: string): Promise<JudgeRecord | undefined> {
    return db.judges.get(id);
  },

  /** Invite a judge by email: creates a demo user + pending judge record. */
  async inviteJudge(hackathonId: string, email: string): Promise<JudgeWithUser> {
    let user = await usersRepository.getByEmail(email);
    if (!user) {
      user = await usersRepository.create({
        email,
        name: email.split("@")[0],
        password: "demo1234",
        password_must_change: true,
      });
    }
    const existing = await this.getJudge(hackathonId, user.id);
    if (existing) {
      throw new Error("JUDGE_ALREADY_INVITED");
    }
    const record: JudgeRecord = {
      id: uuid(),
      hackathon_id: hackathonId,
      user_id: user.id,
      status: "pending",
      invited_at: now(),
      accepted_at: null,
    };
    await db.judges.add(record);
    return {
      ...record,
      user: { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url },
    };
  },

  /** Judge invite acceptance: activate the judge record. */
  async acceptJudgeInvite(hackathonId: string, userId: string): Promise<JudgeRecord | undefined> {
    const judge = await this.getJudge(hackathonId, userId);
    if (!judge) return undefined;
    if (judge.status !== "pending") throw new Error("JUDGE_NOT_PENDING");
    const updated: JudgeRecord = { ...judge, status: "accepted", accepted_at: now() };
    await db.judges.put(updated);
    return updated;
  },

  async declineJudgeInvite(hackathonId: string, userId: string): Promise<JudgeRecord | undefined> {
    const judge = await this.getJudge(hackathonId, userId);
    if (!judge) return undefined;
    const updated: JudgeRecord = { ...judge, status: "declined" };
    await db.judges.put(updated);
    return updated;
  },

  async removeJudge(id: string): Promise<boolean> {
    const existing = await db.judges.get(id);
    if (!existing) return false;
    await db.judges.delete(id);
    await db.judgeAssignments.where("judge_id").equals(id).delete();
    return true;
  },

  // -------------------------------------------------------------------------
  // Rubrics
  // -------------------------------------------------------------------------

  async listRubric(hackathonId: string): Promise<RubricCriterionRecord[]> {
    const rows = await db.rubrics.where("hackathon_id").equals(hackathonId).toArray();
    return rows.sort((a, b) => a.sort_order - b.sort_order);
  },

  async createCriterion(
    hackathonId: string,
    input: { name: string; description?: string; max_score: number; weight: number; track_id?: string | null; sort_order?: number },
  ): Promise<RubricCriterionRecord> {
    const existing = await this.listRubric(hackathonId);
    const record: RubricCriterionRecord = {
      id: uuid(),
      hackathon_id: hackathonId,
      name: input.name,
      description: input.description ?? null,
      max_score: input.max_score,
      weight: input.weight,
      track_id: input.track_id ?? null,
      sort_order: input.sort_order ?? existing.length,
      created_at: now(),
    };
    await db.rubrics.add(record);
    return record;
  },

  async updateCriterion(id: string, input: Partial<Omit<RubricCriterionRecord, "id" | "hackathon_id" | "created_at">>): Promise<RubricCriterionRecord | undefined> {
    const existing = await db.rubrics.get(id);
    if (!existing) return undefined;
    const updated: RubricCriterionRecord = { ...existing, ...input };
    await db.rubrics.put(updated);
    return updated;
  },

  async deleteCriterion(id: string): Promise<boolean> {
    const existing = await db.rubrics.get(id);
    if (!existing) return false;
    await db.rubrics.delete(id);
    return true;
  },

  // -------------------------------------------------------------------------
  // Assignments
  // -------------------------------------------------------------------------

  async listAssignments(hackathonId: string): Promise<AssignmentWithDetails[]> {
    const rows = await db.judgeAssignments.where("hackathon_id").equals(hackathonId).toArray();
    return this.decorateAssignments(rows);
  },

  async listAssignmentsByJudge(judgeId: string, hackathonId: string): Promise<AssignmentWithDetails[]> {
    const rows = await db.judgeAssignments
      .where("judge_id")
      .equals(judgeId)
      .and((a) => a.hackathon_id === hackathonId)
      .toArray();
    return this.decorateAssignments(rows);
  },

  async getAssignment(id: string): Promise<JudgeAssignmentRecord | undefined> {
    return db.judgeAssignments.get(id);
  },

  async decorateAssignments(rows: JudgeAssignmentRecord[]): Promise<AssignmentWithDetails[]> {
    return Promise.all(
      rows.map(async (row) => {
        const [team, submission, judge, scores] = await Promise.all([
          db.teams.get(row.team_id),
          row.submission_id ? db.submissions.get(row.submission_id) : undefined,
          db.judges.get(row.judge_id).then((j) => (j ? db.users.get(j.user_id) : undefined)),
          db.scores.where("assignment_id").equals(row.id).toArray(),
        ]);
        return {
          ...row,
          team: team ? { id: team.id, name: team.name } : null,
          submission: submission
            ? {
                id: submission.id,
                tag_name: submission.tag_name,
                commit_sha: submission.commit_sha,
                submitted_at: submission.submitted_at,
              }
            : null,
          judge_name: judge?.name ?? null,
          scores,
        };
      }),
    );
  },

  /** Bulk-assign submissions to judges for a round. */
  async createAssignments(
    hackathonId: string,
    judgeIds: string[],
    submissionIds: string[],
    round: number,
  ): Promise<JudgeAssignmentRecord[]> {
    const created: JudgeAssignmentRecord[] = [];
    await db.transaction("rw", db.judgeAssignments, async () => {
      for (const judgeId of judgeIds) {
        for (const submissionId of submissionIds) {
          const submission = await db.submissions.get(submissionId);
          if (!submission) continue;
          const existing = await db.judgeAssignments
            .where("judge_id")
            .equals(judgeId)
            .and((a) => a.submission_id === submissionId && a.round === round)
            .first();
          if (existing) continue;
          const record: JudgeAssignmentRecord = {
            id: uuid(),
            hackathon_id: hackathonId,
            judge_id: judgeId,
            team_id: submission.team_id,
            submission_id: submissionId,
            round,
            status: "pending",
            assigned_at: now(),
            completed_at: null,
          };
          await db.judgeAssignments.add(record);
          created.push(record);
        }
      }
    });
    return created;
  },

  async reassignAssignment(assignmentId: string, newJudgeId: string): Promise<JudgeAssignmentRecord | undefined> {
    const existing = await this.getAssignment(assignmentId);
    if (!existing) return undefined;
    const updated: JudgeAssignmentRecord = { ...existing, judge_id: newJudgeId, status: "pending", completed_at: null };
    await db.judgeAssignments.put(updated);
    return updated;
  },

  async setAssignmentStatus(id: string, status: JudgeAssignmentRecord["status"]): Promise<JudgeAssignmentRecord | undefined> {
    const existing = await this.getAssignment(id);
    if (!existing) return undefined;
    const updated: JudgeAssignmentRecord = {
      ...existing,
      status,
      completed_at: status === "scored" ? now() : existing.completed_at,
    };
    await db.judgeAssignments.put(updated);
    return updated;
  },

  // -------------------------------------------------------------------------
  // Conflicts of interest
  // -------------------------------------------------------------------------

  async listConflicts(hackathonId: string): Promise<ConflictRecord[]> {
    const assignments = await db.judgeAssignments.where("hackathon_id").equals(hackathonId).toArray();
    const assignmentIds = new Set(assignments.map((a) => a.id));
    const rows = await db.conflicts.toArray();
    return rows.filter((c) => assignmentIds.has(c.assignment_id));
  },

  async declareConflict(assignmentId: string, judgeId: string, reason: string): Promise<ConflictRecord> {
    const assignment = await this.getAssignment(assignmentId);
    if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
    const existing = await db.conflicts
      .where("assignment_id")
      .equals(assignmentId)
      .and((c) => c.judge_id === judgeId)
      .first();
    if (existing) {
      await db.conflicts.update(existing.id, { status: "declared", reason });
      await this.setAssignmentStatus(assignmentId, "skipped");
      return { ...existing, status: "declared", reason };
    }
    const record: ConflictRecord = {
      id: uuid(),
      assignment_id: assignmentId,
      judge_id: judgeId,
      submission_id: assignment.submission_id ?? "",
      status: "declared",
      reason,
      declared_at: now(),
    };
    await db.conflicts.add(record);
    await this.setAssignmentStatus(assignmentId, "skipped");
    return record;
  },

  async clearConflict(assignmentId: string): Promise<boolean> {
    const count = await db.conflicts.where("assignment_id").equals(assignmentId).delete();
    if (count > 0) {
      await this.setAssignmentStatus(assignmentId, "pending");
    }
    return count > 0;
  },

  // -------------------------------------------------------------------------
  // Scores
  // -------------------------------------------------------------------------

  /** Submit (or replace) scores for an assignment; marks the assignment scored. */
  async submitScores(assignmentId: string, scores: SubmitScoreInput[]): Promise<ScoreRecord[]> {
    const assignment = await this.getAssignment(assignmentId);
    if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
    const submissionId = assignment.submission_id;
    if (!submissionId) throw new Error("ASSIGNMENT_NO_SUBMISSION");

    const created: ScoreRecord[] = [];
    await db.transaction("rw", db.scores, db.judgeAssignments, async () => {
      await db.scores.where("assignment_id").equals(assignmentId).delete();
      for (const input of scores) {
        const record: ScoreRecord = {
          id: uuid(),
          assignment_id: assignmentId,
          judge_id: assignment.judge_id,
          submission_id: submissionId,
          criterion_id: input.criterion_id,
          round: assignment.round,
          score: input.score,
          comment: input.comment ?? null,
          created_at: now(),
          updated_at: now(),
        };
        await db.scores.add(record);
        created.push(record);
      }
      await this.setAssignmentStatus(assignmentId, "scored");
    });
    return created;
  },

  async scoresForSubmission(submissionId: string): Promise<ScoreRecord[]> {
    const rows = await db.scores.where("submission_id").equals(submissionId).toArray();
    return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async myScores(judgeId: string, hackathonId: string): Promise<AssignmentWithDetails[]> {
    const assignments = await this.listAssignmentsByJudge(judgeId, hackathonId);
    const scored: AssignmentWithDetails[] = [];
    for (const assignment of assignments) {
      const scores = await db.scores.where("assignment_id").equals(assignment.id).toArray();
      if (scores.length > 0) {
        scored.push({ ...assignment, scores });
      }
    }
    return scored;
  },

  // -------------------------------------------------------------------------
  // Leaderboard
  // -------------------------------------------------------------------------

  leaderboard: computeLeaderboard,
};