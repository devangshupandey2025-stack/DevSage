import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { hackathonRounds } from './hackathon-rounds.js';
import { teams } from './teams.js';
import { users } from './users.js';

export const roundResults = sqliteTable('round_results', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  round_id: text('round_id').notNull().references(() => hackathonRounds.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  rank: integer('rank'),
  total_score: real('total_score'),
  decided_by: text('decided_by').references(() => users.id),
  created_at: text('created_at').notNull(),
}, (table) => ({
  roundTeamUniq: uniqueIndex('round_results_round_team_idx').on(table.round_id, table.team_id),
  hackathonStatusIdx: index('round_results_hackathon_status_idx').on(table.hackathon_id, table.status),
  teamIdx: index('round_results_team_idx').on(table.team_id),
}));
