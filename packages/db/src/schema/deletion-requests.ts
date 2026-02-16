import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const deletionRequests = sqliteTable('deletion_requests', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  confirmation_token: text('confirmation_token').notNull().unique(),
  status: text('status').notNull().default('pending'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  confirmed_at: text('confirmed_at'),
}, (table) => ({
  userIdx: index('idx_deletion_requests_user').on(table.user_id),
}));
