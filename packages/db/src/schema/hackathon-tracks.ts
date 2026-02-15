import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';

export const hackathonTracks = sqliteTable('hackathon_tracks', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id),
  name: text('name').notNull(),
  description: text('description'),
  max_teams: integer('max_teams'),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull(),
}, (table) => ({
  idxTracksHackathon: index('idx_hackathon_tracks_hackathon').on(table.hackathon_id),
  uniqueTrackName: uniqueIndex('unique_hackathon_track_name').on(table.hackathon_id, table.name),
}));
