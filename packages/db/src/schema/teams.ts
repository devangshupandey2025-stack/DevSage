import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';
import { hackathonTracks } from './hackathon-tracks.js';

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  invite_code: text('invite_code').notNull().unique(),
  track_id: text('track_id').references(() => hackathonTracks.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('forming'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updated_at: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  hackathonIdx: index('idx_teams_hackathon').on(table.hackathon_id),
  inviteCodeIdx: index('idx_teams_invite_code').on(table.invite_code),
}));
