import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';
import { hackathonTracks } from './hackathon-tracks.js';

export const rubricCriteria = sqliteTable('rubric_criteria', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  max_score: integer('max_score').notNull().default(10),
  weight: real('weight').notNull().default(1.0),
  track_id: text('track_id').references(() => hackathonTracks.id, { onDelete: 'cascade' }),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  hackathonIdx: index('idx_rubric_criteria_hackathon').on(table.hackathon_id),
}));
