/**
 * Announcements repository.
 */

import { db } from "../db/database.js";
import type { AnnouncementRecord } from "../db/schema.js";
import { now, uuid } from "../lib/utils.js";

export interface CreateAnnouncementInput {
  hackathon_id: string;
  title: string;
  body?: string | null;
  created_by: string;
}

export const announcementsRepository = {
  async listByHackathon(hackathonId: string): Promise<AnnouncementRecord[]> {
    const rows = await db.announcements.where("hackathon_id").equals(hackathonId).toArray();
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async getById(id: string): Promise<AnnouncementRecord | undefined> {
    return db.announcements.get(id);
  },

  async create(input: CreateAnnouncementInput): Promise<AnnouncementRecord> {
    const record: AnnouncementRecord = {
      id: uuid(),
      hackathon_id: input.hackathon_id,
      title: input.title,
      body: input.body ?? null,
      created_by: input.created_by,
      created_at: now(),
      updated_at: now(),
    };
    await db.announcements.add(record);
    return record;
  },

  async update(id: string, input: Partial<Pick<AnnouncementRecord, "title" | "body">>): Promise<AnnouncementRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: AnnouncementRecord = { ...existing, ...input, updated_at: now() };
    await db.announcements.put(updated);
    return updated;
  },

  async remove(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await db.announcements.delete(id);
    return true;
  },
};