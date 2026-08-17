/**
 * Rounds repository — round CRUD, initialization, results, advancement.
 */

import { db } from "../db/database.js";
import type { RoundRecord, RoundResultRecord } from "../db/schema.js";
import { now, uuid } from "../lib/utils.js";

export interface CreateRoundInput {
  name: string;
  description?: string;
  round_number: number;
  submission_deadline?: string;
  is_elimination?: boolean;
  sort_order?: number;
}

/** Round statuses: draft → published → results → completed. */
export const ROUND_STATUSES = ["draft", "published", "results", "completed"] as const;

export const roundsRepository = {
  async listByHackathon(hackathonId: string): Promise<RoundRecord[]> {
    const rows = await db.rounds.where("hackathon_id").equals(hackathonId).toArray();
    return rows.sort((a, b) => a.round_number - b.round_number);
  },

  async getById(id: string): Promise<RoundRecord | undefined> {
    return db.rounds.get(id);
  },

  async create(hackathonId: string, input: CreateRoundInput): Promise<RoundRecord> {
    const record: RoundRecord = {
      id: uuid(),
      hackathon_id: hackathonId,
      name: input.name,
      description: input.description ?? null,
      round_number: input.round_number,
      status: "draft",
      submission_deadline: input.submission_deadline ?? null,
      is_elimination: input.is_elimination ? 1 : 0,
      sort_order: input.sort_order ?? 0,
      created_at: now(),
      updated_at: now(),
    };
    await db.rounds.add(record);
    return record;
  },

  async update(id: string, input: Partial<Omit<RoundRecord, "id" | "created_at" | "hackathon_id">>): Promise<RoundRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: RoundRecord = { ...existing, ...input, updated_at: now() };
    await db.rounds.put(updated);
    return updated;
  },

  async remove(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await db.rounds.delete(id);
    return true;
  },

  /** Initialize: move a draft round to published (submissions + judging open). */
  async initialize(id: string): Promise<RoundRecord | undefined> {
    const round = await this.getById(id);
    if (!round) return undefined;
    if (round.status !== "draft") throw new Error("ROUND_NOT_DRAFT");
    const updated: RoundRecord = { ...round, status: "published", updated_at: now() };
    await db.rounds.put(updated);
    return updated;
  },

  async getResults(roundId: string): Promise<RoundResultRecord[]> {
    const rows = await db.roundResults.where("round_id").equals(roundId).toArray();
    return rows.sort((a, b) => a.rank - b.rank);
  },

  /**
   * Publish results: compute deterministic rankings from local scores +
   * rubric weights, then store roundResults and mark the round `results`.
   */
  async publishResults(id: string): Promise<RoundResultRecord[]> {
    const round = await this.getById(id);
    if (!round) throw new Error("ROUND_NOT_FOUND");
    if (round.status === "draft") throw new Error("ROUND_NOT_PUBLISHED");

    const { computeLeaderboard } = await import("./judging.js");
    const entries = await computeLeaderboard(round.hackathon_id, round.round_number);

    const advancedLimit = round.is_elimination === 1 ? Math.ceil(entries.length / 2) : entries.length;
    const results: RoundResultRecord[] = entries.map((entry, index) => ({
      id: uuid(),
      round_id: id,
      team_id: entry.team_id,
      rank: index + 1,
      total_score: entry.total,
      advanced: index < advancedLimit ? 1 : 0,
      created_at: now(),
    }));

    await db.transaction("rw", db.roundResults, db.rounds, async () => {
      await db.roundResults.where("round_id").equals(id).delete();
      await db.roundResults.bulkAdd(results);
      await db.rounds.update(id, { status: "results", updated_at: now() });
    });
    return results;
  },

  /**
   * Advance: create the next round from the results of the current round.
   * Returns the new round (status `published`).
   */
  async advance(id: string): Promise<RoundRecord | undefined> {
    const round = await this.getById(id);
    if (!round) return undefined;
    if (round.status === "draft") throw new Error("ROUND_NOT_PUBLISHED");

    const nextNumber = round.round_number + 1;
    const existingNext = await db.rounds
      .where("hackathon_id")
      .equals(round.hackathon_id)
      .and((r) => r.round_number === nextNumber)
      .first();
    if (existingNext) {
      const updated: RoundRecord = { ...existingNext, status: "published", updated_at: now() };
      await db.rounds.put(updated);
      return updated;
    }
    const next: RoundRecord = {
      id: uuid(),
      hackathon_id: round.hackathon_id,
      name: `Round ${nextNumber}`,
      description: null,
      round_number: nextNumber,
      status: "published",
      submission_deadline: null,
      is_elimination: 0,
      sort_order: nextNumber - 1,
      created_at: now(),
      updated_at: now(),
    };
    await db.rounds.add(next);
    return next;
  },
};