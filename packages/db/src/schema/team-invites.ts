import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { teams } from './teams.js';

export const teamInvites = sqliteTable('team_invites', {
  id: text('id').primaryKey(),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  token_hash: text('token_hash').notNull().unique(),
  status: text('status', { enum: ['pending', 'accepted', 'expired'] }).notNull().default('pending'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  idxTeamInvitesTeam: index('idx_team_invites_team').on(table.team_id),
  idxTeamInvitesEmail: index('idx_team_invites_email').on(table.email, table.status),
}));
