import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  invite_code: text('invite_code').unique(),
  track_id: text('track_id'),
  ready: integer('ready').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => ({
  uniqueHackathonName: unique().on(table.hackathon_id, table.name),
  idxTeamsHackathon: index('idx_teams_hackathon').on(table.hackathon_id),
  idxTeamsInviteCode: index('idx_teams_invite_code').on(table.invite_code),
}));
