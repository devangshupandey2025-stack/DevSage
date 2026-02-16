import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { teams } from './teams.js';

export const webhookDeliveries = sqliteTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  delivery_id: text('delivery_id').notNull().unique(),
  provider: text('provider').notNull(),
  event_type: text('event_type').notNull(),
  status: text('status', { enum: ['received', 'processing', 'processed', 'failed', 'dead_lettered'] }).notNull().default('received'),
  repo_full_name: text('repo_full_name').notNull(),
  hackathon_id: text('hackathon_id').references(() => hackathons.id),
  team_id: text('team_id').references(() => teams.id),
  payload_summary: text('payload_summary'),
  error_message: text('error_message'),
  processing_ms: integer('processing_ms'),
  retry_count: integer('retry_count').notNull().default(0),
  received_at: text('received_at').notNull(),
  processed_at: text('processed_at'),
}, (table) => ({
  hackathonIdx: index('webhook_deliveries_hackathon_idx').on(table.hackathon_id, table.received_at),
  statusIdx: index('webhook_deliveries_status_idx').on(table.status),
  repoIdx: index('webhook_deliveries_repo_idx').on(table.repo_full_name),
}));
