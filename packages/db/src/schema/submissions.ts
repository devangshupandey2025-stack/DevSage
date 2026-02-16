import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { teams } from './teams.js';
import { hackathons } from './hackathons.js';
import { hackathonRounds } from './hackathon-rounds.js';

export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  tag_name: text('tag_name').notNull(),
  commit_sha: text('commit_sha').notNull(),
  commit_message: text('commit_message'),
  commit_author: text('commit_author'),
  branch: text('branch').default('main'),
  provider: text('provider').notNull().default('github'),
  repo_full_name: text('repo_full_name').notNull(),
  round_id: text('round_id').notNull().references(() => hackathonRounds.id),
  demo_url: text('demo_url'),
  status: text('status', {
    enum: ['received', 'validated', 'validation_failed', 'locked', 'under_review', 'scored', 'invalid', 'superseded']
  }).notNull().default('received'),
  rejection_reason: text('rejection_reason'),
  is_late: integer('is_late').notNull().default(0),
  is_final: integer('is_final').notNull().default(0),
  validation_results: text('validation_results'),
  locked_at: text('locked_at'),
  finalized_at: text('finalized_at'),
  submitted_at: text('submitted_at').notNull(),
  received_at: text('received_at').notNull(),
  webhook_delivery_id: text('webhook_delivery_id').unique(),
}, (table) => ({
  uniqueTeamTag: unique().on(table.team_id, table.tag_name),
  idxSubmissionsHackathonStatus: index('idx_submissions_hackathon_status').on(table.hackathon_id, table.status),
  idxSubmissionsTeam: index('idx_submissions_team').on(table.team_id),
  idxSubmissionsHackathonFinal: index('idx_submissions_hackathon_final').on(table.hackathon_id, table.is_final),
  idxSubmissionsRoundTeam: index('idx_submissions_round_team').on(table.round_id, table.team_id),
}));
