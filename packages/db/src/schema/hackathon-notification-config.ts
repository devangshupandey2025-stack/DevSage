import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const hackathonNotificationConfig = sqliteTable('hackathon_notification_config', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email_enabled: integer('email_enabled').notNull().default(1),
  in_app_enabled: integer('in_app_enabled').notNull().default(1),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  hackathonUserUniq: uniqueIndex('uq_hackathon_notification_config_hackathon_user').on(table.hackathon_id, table.user_id),
}));
