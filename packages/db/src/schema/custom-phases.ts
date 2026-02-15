import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';

export const customPhases = sqliteTable('custom_phases', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id),
  name: text('name').notNull(),
  description: text('description'),
  parent_state: text('parent_state', {
    enum: ['draft', 'active', 'judging', 'completed', 'archived']
  }).notNull(),
  starts_at: text('starts_at').notNull(),
  ends_at: text('ends_at').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull(),
}, (table) => ({
  idxPhasesHackathon: index('idx_custom_phases_hackathon').on(table.hackathon_id),
}));
