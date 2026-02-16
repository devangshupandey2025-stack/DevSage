import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const notificationIdempotency = sqliteTable('notification_idempotency', {
  id: text('id').primaryKey(),
  idempotency_key: text('idempotency_key').notNull().unique(),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});
