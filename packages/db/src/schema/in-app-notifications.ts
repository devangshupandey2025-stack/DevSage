import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth-user.js';
import { hackathons } from './hackathons.js';

export const inAppNotifications = sqliteTable('in_app_notifications', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  hackathon_id: text('hackathon_id').references(() => hackathons.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'),
  read_at: text('read_at'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  userReadIdx: index('idx_notifications_user_read').on(table.user_id, table.read_at),
  hackathonIdx: index('idx_notifications_hackathon').on(table.hackathon_id),
}));
