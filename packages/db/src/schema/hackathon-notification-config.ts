import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';

export const hackathonNotificationConfig = sqliteTable('hackathon_notification_config', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().unique().references(() => hackathons.id),
  email_from_name: text('email_from_name'),
  email_reply_to: text('email_reply_to'),
  broadcast_cooldown_minutes: integer('broadcast_cooldown_minutes').notNull().default(12),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
