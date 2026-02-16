import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';
import { teams } from './teams.js';
import { hackathonRounds } from './hackathon-rounds.js';

export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  round_id: text('round_id').references(() => hackathonRounds.id, { onDelete: 'set null' }),
  tag_name: text('tag_name').notNull(),
  commit_sha: text('commit_sha').notNull(),
  submitted_at: text('submitted_at').notNull(),
  status: text('status').notNull().default('pending_validation'),
  validated_at: text('validated_at'),
  validation_results: text('validation_results'),
  delivery_id: text('delivery_id').unique(),
  is_current: integer('is_current').notNull().default(1),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  hackathonCurrentIdx: index('idx_submissions_hackathon_current').on(table.hackathon_id, table.is_current),
  teamRoundIdx: index('idx_submissions_team_round').on(table.team_id, table.round_id),
}));
