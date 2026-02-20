import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth-user.js';

export const platformAdmins = sqliteTable('platform_admins', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  added_by: text('added_by').references(() => user.id, { onDelete: 'set null' }),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});
