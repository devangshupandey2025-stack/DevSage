/**
 * Submissions repository — local submission state.
 */

import { db } from "../db/database.js";
import type { SubmissionRecord } from "../db/schema.js";
import { now, uuid } from "../lib/utils.js";

export interface CreateSubmissionInput {
  hackathon_id: string;
  team_id: string;
  round_id?: string | null;
  tag_name: string;
  commit_sha: string;
  status?: SubmissionRecord["status"];
}

export const submissionsRepository = {
  async listByHackathon(
    hackathonId: string,
    options?: { round_id?: string; current_only?: boolean },
  ): Promise<SubmissionRecord[]> {
    let rows = await db.submissions.where("hackathon_id").equals(hackathonId).toArray();
    if (options?.round_id) rows = rows.filter((s) => s.round_id === options.round_id);
    if (options?.current_only) rows = rows.filter((s) => s.is_current === 1);
    return rows.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  },

  async getById(id: string): Promise<SubmissionRecord | undefined> {
    return db.submissions.get(id);
  },

  /** Current submission for a team, optionally within a round. */
  async getCurrentForTeam(teamId: string, roundId?: string): Promise<SubmissionRecord | undefined> {
    let query = db.submissions
      .where("team_id")
      .equals(teamId)
      .and((s) => s.is_current === 1);
    if (roundId) {
      query = query.and((s) => s.round_id === roundId);
    }
    return query.first();
  },

  async listByTeam(teamId: string): Promise<SubmissionRecord[]> {
    const rows = await db.submissions.where("team_id").equals(teamId).toArray();
    return rows.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  },

  async create(input: CreateSubmissionInput): Promise<SubmissionRecord> {
    const record: SubmissionRecord = {
      id: uuid(),
      hackathon_id: input.hackathon_id,
      team_id: input.team_id,
      round_id: input.round_id ?? null,
      tag_name: input.tag_name,
      commit_sha: input.commit_sha,
      submitted_at: now(),
      status: input.status ?? "pending_validation",
      validated_at: input.status === "validated" ? now() : null,
      is_current: 1,
      created_at: now(),
    };
    await db.transaction("rw", db.submissions, async () => {
      // New submissions supersede prior current submissions for the same team+round.
      const prior = await this.getCurrentForTeam(input.team_id, input.round_id ?? undefined);
      if (prior) await db.submissions.update(prior.id, { is_current: 0 });
      await db.submissions.add(record);
    });
    return record;
  },

  async update(id: string, input: Partial<Omit<SubmissionRecord, "id" | "created_at">>): Promise<SubmissionRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: SubmissionRecord = { ...existing, ...input };
    await db.submissions.put(updated);
    return updated;
  },

  /** Local validation simulation: mark a submission validated. */
  async validate(id: string): Promise<SubmissionRecord | undefined> {
    return this.update(id, { status: "validated", validated_at: now() });
  },

  async remove(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await db.submissions.delete(id);
    return true;
  },

  async countByHackathon(hackathonId: string): Promise<number> {
    return db.submissions.where("hackathon_id").equals(hackathonId).count();
  },
};