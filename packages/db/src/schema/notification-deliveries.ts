import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth-user.js';

export const notificationDeliveries = sqliteTable('notification_deliveries', {
  id: text('id').primaryKey(),
  notification_type: text('notification_type').notNull(),
  channel: text('channel').notNull(),
  recipient_id: text('recipient_id').references(() => user.id, { onDelete: 'set null' }),
  recipient_email: text('recipient_email'),
  status: text('status').notNull().default('sent'),
  error_message: text('error_message'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  recipientIdx: index('idx_notification_deliveries_recipient').on(table.recipient_id),
  statusIdx: index('idx_notification_deliveries_status').on(table.status),
}));
