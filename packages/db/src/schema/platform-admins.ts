import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const platformAdmins = sqliteTable('platform_admins', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().unique().references(() => users.id),
  role: text('role', { enum: ['super_admin', 'platform_admin'] }).notNull().default('platform_admin'),
  created_by: text('created_by').references(() => users.id),
  created_at: text('created_at').notNull(),
});
