import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';

export const rubricCriteria = sqliteTable('rubric_criteria', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  max_score: integer('max_score').notNull().default(10),
  weight: real('weight').notNull().default(1.0),
  sort_order: integer('sort_order').notNull().default(0),
}, (table) => ({
  uniqueHackathonName: unique().on(table.hackathon_id, table.name),
}));
