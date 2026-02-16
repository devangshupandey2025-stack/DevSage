import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const webhookDeliveries = sqliteTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  github_delivery_id: text('github_delivery_id').notNull().unique(),
  event_type: text('event_type').notNull(),
  status: text('status').notNull().default('queued'),
  error_message: text('error_message'),
  received_at: text('received_at').notNull(),
  processed_at: text('processed_at'),
}, (table) => ({
  eventIdx: index('idx_webhook_deliveries_event').on(table.event_type),
  statusIdx: index('idx_webhook_deliveries_status').on(table.status),
}));
