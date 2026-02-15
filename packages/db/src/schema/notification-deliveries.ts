import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const notificationDeliveries = sqliteTable('notification_deliveries', {
  id: text('id').primaryKey(),
  event_id: text('event_id').notNull(),
  user_id: text('user_id').notNull().references(() => users.id),
  channel: text('channel', { enum: ['email', 'in_app'] }).notNull(),
  notification_type: text('notification_type').notNull(),
  status: text('status', { enum: ['pending', 'delivered', 'failed', 'permanent_failure', 'dead_lettered'] }).notNull().default('pending'),
  error_message: text('error_message'),
  attempts: integer('attempts').notNull().default(0),
  delivered_at: text('delivered_at'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  eventUserChannelIdx: uniqueIndex('notification_deliveries_event_user_channel_idx').on(table.event_id, table.user_id, table.channel),
  userIdx: index('notification_deliveries_user_idx').on(table.user_id, table.created_at),
  statusIdx: index('notification_deliveries_status_idx').on(table.status),
}));
