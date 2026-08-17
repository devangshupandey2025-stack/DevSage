/**
 * Activity repository — local activity/audit log.
 *
 * This is a UI-facing activity feed, NOT a cryptographically chained audit
 * trail. The hash-chain integrity guarantee of the backend is intentionally
 * not reproduced in the browser.
 */

import { db } from "../db/database.js";
import type { ActivityRecord } from "../db/schema.js";
import { now, uuid } from "../lib/utils.js";

export interface CreateActivityInput {
  hackathon_id?: string | null;
  actor_id?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, unknown> | null;
}

export const activityRepository = {
  async listByHackathon(
    hackathonId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ items: ActivityRecord[]; next_cursor: string | null }> {
    let rows = await db.activity
      .where("hackathon_id")
      .equals(hackathonId)
      .toArray();
    rows = rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const limit = Math.max(1, Math.min(100, options?.limit ?? 20));
    let start = 0;
    if (options?.cursor) {
      const idx = rows.findIndex((r) => r.id === options.cursor);
      if (idx >= 0) start = idx + 1;
    }
    const page = rows.slice(start, start + limit);
    const next_cursor = start + page.length < rows.length ? page[page.length - 1].id : null;
    return { items: page, next_cursor };
  },

  async listRecent(limit = 50): Promise<ActivityRecord[]> {
    const rows = await db.activity.orderBy("created_at").reverse().limit(limit).toArray();
    return rows;
  },

  async create(input: CreateActivityInput): Promise<ActivityRecord> {
    const record: ActivityRecord = {
      id: uuid(),
      hackathon_id: input.hackathon_id ?? null,
      actor_id: input.actor_id ?? null,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      metadata: input.metadata ?? null,
      created_at: now(),
    };
    await db.activity.add(record);
    return record;
  },
};