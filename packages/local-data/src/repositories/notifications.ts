/**
 * Notifications repository — read/unread state, generated synchronously
 * by local actions (no queues, no email).
 */

import { db } from "../db/database.js";
import type { NotificationRecord } from "../db/schema.js";
import { now, uuid } from "../lib/utils.js";

export interface CreateNotificationInput {
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

export const notificationsRepository = {
  async listForUser(userId: string, limit = 20, offset = 0): Promise<{ items: NotificationRecord[]; has_more: boolean; total: number }> {
    const rows = await db.notifications.where("user_id").equals(userId).toArray();
    const sorted = rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const total = sorted.length;
    return {
      items: sorted.slice(offset, offset + limit),
      has_more: offset + limit < total,
      total,
    };
  },

  async unreadCount(userId: string): Promise<number> {
    return db.notifications.where("user_id").equals(userId).and((n) => n.is_read === 0).count();
  },

  async markRead(id: string, userId: string): Promise<boolean> {
    const record = await db.notifications.get(id);
    if (!record || record.user_id !== userId) return false;
    await db.notifications.update(id, { is_read: 1, read_at: now() });
    return true;
  },

  async markAllRead(userId: string): Promise<number> {
    const unread = await db.notifications
      .where("user_id")
      .equals(userId)
      .and((n) => n.is_read === 0)
      .toArray();
    const ids = unread.map((n) => n.id);
    await db.notifications.bulkUpdate(
      ids.map((id) => ({ key: id, changes: { is_read: 1, read_at: now() } })),
    );
    return ids.length;
  },

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: uuid(),
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      is_read: 0,
      read_at: null,
      created_at: now(),
    };
    await db.notifications.add(record);
    return record;
  },

  async createForMany(users: string[], input: Omit<CreateNotificationInput, "user_id">): Promise<NotificationRecord[]> {
    const records: NotificationRecord[] = users.map((userId) => ({
      id: uuid(),
      user_id: userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      is_read: 0,
      read_at: null,
      created_at: now(),
    }));
    await db.notifications.bulkAdd(records);
    return records;
  },

  async remove(id: string): Promise<boolean> {
    const existing = await db.notifications.get(id);
    if (!existing) return false;
    await db.notifications.delete(id);
    return true;
  },
};