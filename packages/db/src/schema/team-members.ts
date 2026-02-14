import { sqliteTable, text, unique, index } from 'drizzle-orm/sqlite-core';
import { teams } from './teams.js';
import { users } from './users.js';

export const teamMembers = sqliteTable('team_members', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['leader', 'member'] }).notNull().default('member'),
  joined_at: text('joined_at').notNull(),
}, (table) => ({
  uniqueTeamUser: unique().on(table.team_id, table.user_id),
  idxTeamMembersUser: index('idx_team_members_user').on(table.user_id),
  idxTeamMembersTeam: index('idx_team_members_team').on(table.team_id),
}));
