import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const platformAdmins = sqliteTable('platform_admins', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().unique().references(() => users.id),
  created_at: text('created_at').notNull(),
});
