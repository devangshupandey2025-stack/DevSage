import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { teams } from './teams.js';
import { hackathons } from './hackathons.js';

export const commitLog = sqliteTable('commit_log', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  commit_sha: text('commit_sha').notNull(),
  message: text('message'),
  author_username: text('author_username'),
  branch: text('branch').default('main'),
  pushed_at: text('pushed_at').notNull(),
  is_force_push: integer('is_force_push').notNull().default(0),
  commits_in_push: integer('commits_in_push').default(1),
  webhook_delivery_id: text('webhook_delivery_id'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  idxCommitLogTeam: index('idx_commit_log_team').on(table.team_id, table.pushed_at),
  idxCommitLogHackathon: index('idx_commit_log_hackathon').on(table.hackathon_id, table.pushed_at),
}));
