import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';

export const customPhases = sqliteTable('custom_phases', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  parent_status: text('parent_status').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  sort_order: integer('sort_order').notNull().default(0),
  start_date: text('start_date'),
  end_date: text('end_date'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  hackathonIdx: index('idx_custom_phases_hackathon').on(table.hackathon_id),
}));
