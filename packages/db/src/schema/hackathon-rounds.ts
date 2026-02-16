import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';

export const hackathonRounds = sqliteTable('hackathon_rounds', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  round_number: integer('round_number').notNull(),
  submission_deadline: text('submission_deadline'),
  is_elimination: integer('is_elimination').notNull().default(0),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  hackathonRoundUniq: uniqueIndex('uq_hackathon_rounds_hackathon_round').on(table.hackathon_id, table.round_number),
}));
