import { sqliteTable, text, unique, index } from 'drizzle-orm/sqlite-core';
import { hackathons } from './hackathons.js';
import { users } from './users.js';

export const judges = sqliteTable('judges', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id),
  invite_status: text('invite_status', { enum: ['pending', 'accepted', 'declined', 'removed'] }).notNull().default('pending'),
  track_id: text('track_id'),
  invited_by: text('invited_by').notNull().references(() => users.id),
  invited_at: text('invited_at').notNull(),
  responded_at: text('responded_at'),
}, (table) => ({
  uniqueHackathonUser: unique().on(table.hackathon_id, table.user_id),
  idxJudgesUser: index('idx_judges_user').on(table.user_id),
}));
