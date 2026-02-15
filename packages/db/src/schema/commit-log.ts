import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { teams } from './teams.js';
import { hackathons } from './hackathons.js';
import { webhookDeliveries } from './webhook-deliveries.js';

export const commitLog = sqliteTable('commit_log', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id),
  team_id: text('team_id').notNull().references(() => teams.id),
  delivery_id: text('delivery_id').references(() => webhookDeliveries.id),
  sha: text('sha').notNull(),
  message: text('message').notNull(),
  author_name: text('author_name').notNull(),
  author_email: text('author_email').notNull(),
  committed_at: text('committed_at').notNull(),
  url: text('url').notNull(),
  branch: text('branch').notNull(),
  files_added: integer('files_added').notNull().default(0),
  files_modified: integer('files_modified').notNull().default(0),
  files_removed: integer('files_removed').notNull().default(0),
  provider: text('provider').notNull().default('github'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  idxCommitLogTeamTime: index('idx_commit_log_team_time').on(table.hackathon_id, table.team_id, table.committed_at),
  idxCommitLogSha: index('idx_commit_log_sha').on(table.sha),
  idxCommitLogDelivery: index('idx_commit_log_delivery').on(table.delivery_id),
}));
