import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { teams } from './teams.js';
import { users } from './users.js';

export const teamMembers = sqliteTable('team_members', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  joined_at: text('joined_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  teamUserUniq: uniqueIndex('uq_team_members_team_user').on(table.team_id, table.user_id),
  userIdx: index('idx_team_members_user').on(table.user_id),
}));
