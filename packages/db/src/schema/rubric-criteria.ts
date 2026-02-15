import { sqliteTable, text, integer, real, unique, index } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';

export const rubricCriteria = sqliteTable('rubric_criteria', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  track_id: text('track_id'),
  round: integer('round').notNull().default(1),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  max_score: integer('max_score').notNull().default(10),
  weight: real('weight').notNull().default(1.0),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull(),
}, (table) => ({
  uniqueHackathonNameTrackRound: unique().on(table.hackathon_id, table.name, table.track_id, table.round),
  idxRubricRound: index('idx_rubric_round').on(table.hackathon_id, table.round),
}));
