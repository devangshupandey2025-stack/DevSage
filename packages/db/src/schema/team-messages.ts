import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { teams } from './teams.js';
import { users } from './users.js';

export const teamMessages = sqliteTable('team_messages', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  created_at: text('created_at').notNull(),
}, (table) => ({
  idxTeamMessagesTeamTime: index('idx_team_messages_team_time').on(table.team_id, table.created_at),
}));
