import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const platformInvites = sqliteTable('platform_invites', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  invite_code: text('invite_code').notNull().unique(),
  status: text('status').notNull().default('pending'),
  created_by: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  expires_at: text('expires_at').notNull(),
}, (table) => ({
  emailIdx: index('idx_platform_invites_email').on(table.email),
}));
