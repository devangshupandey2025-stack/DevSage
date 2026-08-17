/**
 * Hackathons repository — CRUD, lifecycle transition simulation.
 */

import { db } from "../db/database.js";
import type { HackathonRecord } from "../db/schema.js";
import type { HackathonStatus } from "@devsage/shared";
import { now, uuid } from "../lib/utils.js";

export type CreateHackathonInput = Partial<Omit<HackathonRecord, "id" | "created_at" | "updated_at">> & {
  title: string;
  slug: string;
  workspace_id: string;
  created_by: string;
};

/** Forward-only state machine; archived → completed allowed for score corrections. */
export const HACKATHON_TRANSITIONS: Record<HackathonStatus, HackathonStatus[]> = {
  draft: ["active"],
  active: ["judging"],
  judging: ["completed"],
  completed: ["archived"],
  archived: ["completed"],
};

export const hackathonsRepository = {
  async list(options?: {
    status?: HackathonStatus;
    workspace_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: HackathonRecord[]; total: number; has_more: boolean }> {
    let rows = await db.hackathons.orderBy("created_at").reverse().toArray();
    if (options?.status) rows = rows.filter((h) => h.status === options.status);
    if (options?.workspace_id) rows = rows.filter((h) => h.workspace_id === options.workspace_id);
    if (options?.search) {
      const q = options.search.toLowerCase();
      rows = rows.filter(
        (h) => h.title.toLowerCase().includes(q) || h.slug.toLowerCase().includes(q),
      );
    }
    const total = rows.length;
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    return { items: rows.slice(offset, offset + limit), total, has_more: offset + limit < total };
  },

  async getById(id: string): Promise<HackathonRecord | undefined> {
    return db.hackathons.get(id);
  },

  async getBySlug(slug: string): Promise<HackathonRecord | undefined> {
    return db.hackathons.where("slug").equals(slug).first();
  },

  async create(input: CreateHackathonInput): Promise<HackathonRecord> {
    if (await this.getBySlug(input.slug)) {
      throw new Error("SLUG_TAKEN");
    }
    const record: HackathonRecord = {
      id: uuid(),
      title: input.title,
      slug: input.slug,
      workspace_id: input.workspace_id,
      tagline: input.tagline ?? null,
      description: input.description ?? null,
      rules_md: input.rules_md ?? null,
      status: "draft",
      starts_at: input.starts_at ?? null,
      judging_starts: input.judging_starts ?? null,
      judging_ends: input.judging_ends ?? null,
      min_team_size: input.min_team_size ?? 1,
      max_team_size: input.max_team_size ?? 5,
      max_teams: input.max_teams ?? null,
      submission_tag_pattern: input.submission_tag_pattern ?? "submission_v%",
      allow_resubmission: input.allow_resubmission ?? 0,
      allow_registration_during_active: input.allow_registration_during_active ?? 0,
      notify_all_on_deadline: input.notify_all_on_deadline ?? 0,
      show_judge_comments_to_participants: input.show_judge_comments_to_participants ?? 0,
      registration_mode: input.registration_mode ?? "open",
      allowed_email_domains: input.allowed_email_domains ?? "[]",
      require_repo: input.require_repo ?? 1,
      timezone: input.timezone ?? "UTC",
      template_id: input.template_id ?? null,
      tracks: input.tracks ?? "[]",
      prizes: input.prizes ?? "[]",
      settings: input.settings ?? "{}",
      created_by: input.created_by,
      created_at: now(),
      updated_at: now(),
    };
    await db.transaction("rw", db.hackathons, db.organizerRoles, async () => {
      await db.hackathons.add(record);
      await db.organizerRoles.add({
        id: uuid(),
        hackathon_id: record.id,
        user_id: input.created_by,
        role: "organizer",
        created_at: now(),
      });
    });
    return record;
  },

  async update(
    id: string,
    input: Partial<Omit<HackathonRecord, "id" | "created_at">>,
  ): Promise<HackathonRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    if (input.slug && input.slug !== existing.slug) {
      const other = await this.getBySlug(input.slug);
      if (other && other.id !== id) throw new Error("SLUG_TAKEN");
    }
    const updated: HackathonRecord = { ...existing, ...input, updated_at: now() };
    await db.hackathons.put(updated);
    return updated;
  },

  async remove(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await db.hackathons.delete(id);
    return true;
  },

  /** Simulated lifecycle transition with version semantics. */
  async transition(id: string, target: HackathonStatus): Promise<HackathonRecord> {
    const existing = await this.getById(id);
    if (!existing) throw new Error("NOT_FOUND");
    const allowed = HACKATHON_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(target)) {
      throw new Error(`INVALID_TRANSITION:${existing.status}->${target}`);
    }
    const updated: HackathonRecord = { ...existing, status: target, updated_at: now() };
    await db.hackathons.put(updated);
    return updated;
  },

  async countByStatus(): Promise<Record<HackathonStatus, number>> {
    const rows = await db.hackathons.toArray();
    const counts: Record<HackathonStatus, number> = {
      draft: 0,
      active: 0,
      judging: 0,
      completed: 0,
      archived: 0,
    };
    for (const row of rows) counts[row.status] += 1;
    return counts;
  },

  async count(): Promise<number> {
    return db.hackathons.count();
  },

  async organizers(hackathonId: string): Promise<{ user_id: string; role: string }[]> {
    const rows = await db.organizerRoles.where("hackathon_id").equals(hackathonId).toArray();
    return rows.map((r) => ({ user_id: r.user_id, role: r.role }));
  },

  async addOrganizer(hackathonId: string, userId: string, role: "organizer" | "co_organizer"): Promise<void> {
    const existing = await db.organizerRoles
      .where("hackathon_id")
      .equals(hackathonId)
      .and((r) => r.user_id === userId)
      .first();
    if (existing) {
      await db.organizerRoles.update(existing.id, { role });
      return;
    }
    await db.organizerRoles.add({
      id: uuid(),
      hackathon_id: hackathonId,
      user_id: userId,
      role,
      created_at: now(),
    });
  },

  async removeOrganizer(hackathonId: string, userId: string): Promise<void> {
    const existing = await db.organizerRoles
      .where("hackathon_id")
      .equals(hackathonId)
      .and((r) => r.user_id === userId)
      .first();
    if (existing) await db.organizerRoles.delete(existing.id);
  },
};