import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathonRounds } from './hackathon-rounds.js';
import { teams } from './teams.js';

export const roundResults = sqliteTable('round_results', {
  id: text('id').primaryKey(),
  round_id: text('round_id').notNull().references(() => hackathonRounds.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  rank: integer('rank').notNull(),
  total_score: real('total_score').notNull(),
  advanced: integer('advanced').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  roundTeamUniq: uniqueIndex('uq_round_results_round_team').on(table.round_id, table.team_id),
  roundIdx: index('idx_round_results_round').on(table.round_id),
}));
