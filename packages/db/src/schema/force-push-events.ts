import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { teams } from './teams.js';
import { hackathons } from './hackathons.js';
import { users } from './users.js';
import { webhookDeliveries } from './webhook-deliveries.js';

export const forcePushEvents = sqliteTable('force_push_events', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id),
  team_id: text('team_id').notNull().references(() => teams.id),
  delivery_id: text('delivery_id').references(() => webhookDeliveries.id),
  repo_full_name: text('repo_full_name').notNull(),
  branch: text('branch').notNull(),
  before_sha: text('before_sha').notNull(),
  after_sha: text('after_sha').notNull(),
  estimated_lost_commits: integer('estimated_lost_commits').notNull().default(0),
  severity: text('severity', { enum: ['info', 'warning', 'critical'] }).notNull().default('info'),
  affected_submission_ids: text('affected_submission_ids').notNull().default('[]'),
  resolved: integer('resolved').notNull().default(0),
  resolved_by: text('resolved_by').references(() => users.id),
  resolved_at: text('resolved_at'),
  resolution_note: text('resolution_note'),
  provider: text('provider').notNull().default('github'),
  pusher_login: text('pusher_login').notNull(),
  created_at: text('created_at').notNull(),
}, (table) => ({
  idxForcePushHackathonTime: index('idx_force_push_hackathon_time').on(table.hackathon_id, table.created_at),
  idxForcePushTeam: index('idx_force_push_team').on(table.team_id),
  idxForcePushResolved: index('idx_force_push_resolved').on(table.resolved),
}));
