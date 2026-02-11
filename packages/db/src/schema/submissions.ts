import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { teams } from './teams.js';
import { hackathons } from './hackathons.js';

export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  tag_name: text('tag_name').notNull(),
  commit_sha: text('commit_sha').notNull(),
  commit_message: text('commit_message'),
  commit_author: text('commit_author'),
  branch: text('branch').default('main'),
  submitted_at: text('submitted_at').notNull(),
  received_at: text('received_at').notNull(),
  is_late: integer('is_late').notNull().default(0),
  is_final: integer('is_final').notNull().default(0),
  version: integer('version').notNull(),
  status: text('status', {
    enum: ['received', 'validated', 'invalid', 'locked', 'under_review', 'scored', 'invalidated']
  }).notNull().default('received'),
  validation_errors: text('validation_errors'),
  locked_at: text('locked_at'),
  webhook_delivery_id: text('webhook_delivery_id').unique(),
}, (table) => ({
  uniqueTeamTag: unique().on(table.team_id, table.tag_name),
  idxSubmissionsTeam: index('idx_submissions_team').on(table.team_id),
  idxSubmissionsHackathon: index('idx_submissions_hackathon').on(table.hackathon_id),
  idxSubmissionsStatus: index('idx_submissions_status').on(table.hackathon_id, table.status),
  idxSubmissionsWebhook: index('idx_submissions_webhook').on(table.webhook_delivery_id),
}));
