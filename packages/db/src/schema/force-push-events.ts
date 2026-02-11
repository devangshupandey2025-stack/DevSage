import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { teams } from './teams.js';
import { hackathons } from './hackathons.js';

export const forcePushEvents = sqliteTable('force_push_events', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  before_sha: text('before_sha').notNull(),
  after_sha: text('after_sha').notNull(),
  branch: text('branch').notNull(),
  commits_lost_shas: text('commits_lost_shas'),
  commits_lost_count: integer('commits_lost_count').default(0),
  detected_at: text('detected_at').notNull(),
  notified_organizer: integer('notified_organizer').notNull().default(0),
  action_taken: text('action_taken', { enum: ['logged', 'warned', 'flagged'] }).default('logged'),
  submissions_invalidated: text('submissions_invalidated'),
  webhook_delivery_id: text('webhook_delivery_id'),
}, (table) => ({
  idxForcePushTeam: index('idx_force_push_team').on(table.team_id),
}));
