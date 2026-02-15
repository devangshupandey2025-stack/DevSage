import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';
import { hackathons } from './hackathons.js';

export const inAppNotifications = sqliteTable('in_app_notifications', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id),
  hackathon_id: text('hackathon_id').references(() => hackathons.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  icon: text('icon').notNull().default('info'),
  action_url: text('action_url'),
  action_label: text('action_label'),
  metadata: text('metadata').notNull().default('{}'),
  read: integer('read').notNull().default(0),
  read_at: text('read_at'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  userReadIdx: index('in_app_notifications_user_read_idx').on(table.user_id, table.read, table.created_at),
  userHackathonIdx: index('in_app_notifications_user_hackathon_idx').on(table.user_id, table.hackathon_id),
  createdIdx: index('in_app_notifications_created_idx').on(table.created_at),
}));
