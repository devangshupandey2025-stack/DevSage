import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';

export const hackathonRounds = sqliteTable('hackathon_rounds', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  round_number: integer('round_number').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull().default('standard'),
  status: text('status').notNull().default('pending'),
  submission_deadline: text('submission_deadline'),
  started_at: text('started_at'),
  completed_at: text('completed_at'),
  is_initialized: integer('is_initialized').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updated_at: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  hackathonRoundUniq: uniqueIndex('hackathon_rounds_number_idx').on(table.hackathon_id, table.round_number),
  hackathonStatusIdx: index('hackathon_rounds_status_idx').on(table.hackathon_id, table.status),
}));
