import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';

export const hackathonRounds = sqliteTable('hackathon_rounds', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  round_number: integer('round_number').notNull(),
  name: text('name').notNull(),
  type: text('type', { enum: ['normal', 'elimination'] }).notNull().default('normal'),
  status: text('status', {
    enum: ['pending', 'active', 'judging', 'completed'],
  }).notNull().default('pending'),
  submission_deadline: text('submission_deadline'),
  started_at: text('started_at'),
  completed_at: text('completed_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => ({
  uniqueNumber: uniqueIndex('hackathon_rounds_number_idx').on(table.hackathon_id, table.round_number),
  idxStatus: index('hackathon_rounds_status_idx').on(table.hackathon_id, table.status),
}));
