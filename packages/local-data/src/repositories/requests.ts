/**
 * Hackathon requests repository — organizer request pipeline and admin review.
 *
 * Status flow: submitted → under_review → approved → building → ready
 * (rejected is a terminal state from admin review).
 */

import { db } from "../db/database.js";
import type { HackathonRequestRecord, HackathonRequestStatus } from "../db/schema.js";
import { now, uuid } from "../lib/utils.js";

export interface CreateRequestInput {
  workspace_id: string | null;
  requested_by: string;
  title: string;
  description?: string;
  slug: string;
  starts_at?: string;
  ends_at?: string;
  num_events?: number;
  expected_participants?: number;
  team_min_size?: number;
  team_max_size?: number;
  additional_details?: string;
}

export const REQUEST_TRANSITIONS: Record<HackathonRequestStatus, HackathonRequestStatus[]> = {
  submitted: ["under_review"],
  under_review: ["approved", "rejected"],
  approved: ["building"],
  building: ["ready"],
  ready: [],
  rejected: [],
};

export const hackathonRequestsRepository = {
  async list(options?: {
    status?: HackathonRequestStatus;
    workspace_id?: string;
    requested_by?: string;
  }): Promise<HackathonRequestRecord[]> {
    let rows = await db.hackathonRequests.orderBy("created_at").reverse().toArray();
    if (options?.status) rows = rows.filter((r) => r.status === options.status);
    if (options?.workspace_id) rows = rows.filter((r) => r.workspace_id === options.workspace_id);
    if (options?.requested_by) rows = rows.filter((r) => r.requested_by === options.requested_by);
    return rows;
  },

  async getById(id: string): Promise<HackathonRequestRecord | undefined> {
    return db.hackathonRequests.get(id);
  },

  async create(input: CreateRequestInput): Promise<HackathonRequestRecord> {
    const record: HackathonRequestRecord = {
      id: uuid(),
      workspace_id: input.workspace_id,
      requested_by: input.requested_by,
      title: input.title,
      description: input.description ?? null,
      slug: input.slug,
      status: "submitted",
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      starts_at: input.starts_at ?? null,
      ends_at: input.ends_at ?? null,
      num_events: input.num_events ?? null,
      expected_participants: input.expected_participants ?? null,
      team_min_size: input.team_min_size ?? null,
      team_max_size: input.team_max_size ?? null,
      additional_details: input.additional_details ?? null,
      created_at: now(),
      updated_at: now(),
    };
    await db.hackathonRequests.add(record);
    return record;
  },

  /**
   * Resubmit a request that was sent back for changes: persists the new
   * details and resets status to `submitted` so it re-enters the review
   * pipeline.
   */
  async resubmit(id: string, input: CreateRequestInput): Promise<HackathonRequestRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: HackathonRequestRecord = {
      ...existing,
      title: input.title,
      description: input.description ?? existing.description,
      slug: input.slug,
      starts_at: input.starts_at ?? existing.starts_at,
      ends_at: input.ends_at ?? existing.ends_at,
      num_events: input.num_events ?? existing.num_events,
      expected_participants: input.expected_participants ?? existing.expected_participants,
      team_min_size: input.team_min_size ?? existing.team_min_size,
      team_max_size: input.team_max_size ?? existing.team_max_size,
      additional_details: input.additional_details ?? existing.additional_details,
      status: "submitted",
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: now(),
    };
    await db.hackathonRequests.put(updated);
    return updated;
  },

  async update(id: string, input: Partial<Omit<HackathonRequestRecord, "id" | "created_at">>): Promise<HackathonRequestRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: HackathonRequestRecord = { ...existing, ...input, updated_at: now() };
    await db.hackathonRequests.put(updated);
    return updated;
  },

  /** Admin review: set status with optional notes; validates transitions. */
  async review(id: string, status: HackathonRequestStatus, reviewedBy: string, notes?: string): Promise<HackathonRequestRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const allowed = REQUEST_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      throw new Error(`INVALID_REQUEST_TRANSITION:${existing.status}->${status}`);
    }
    const updated: HackathonRequestRecord = {
      ...existing,
      status,
      review_notes: notes ?? existing.review_notes,
      reviewed_by: reviewedBy,
      reviewed_at: now(),
      updated_at: now(),
    };
    await db.hackathonRequests.put(updated);
    return updated;
  },

  async remove(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await db.hackathonRequests.delete(id);
    return true;
  },

  async countByStatus(): Promise<Record<HackathonRequestStatus, number>> {
    const rows = await db.hackathonRequests.toArray();
    const counts: Record<HackathonRequestStatus, number> = {
      submitted: 0,
      under_review: 0,
      approved: 0,
      building: 0,
      ready: 0,
      rejected: 0,
    };
    for (const row of rows) counts[row.status] += 1;
    return counts;
  },
};