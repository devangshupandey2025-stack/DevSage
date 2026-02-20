import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspaces.js';
import { user } from './auth-user.js';

export const hackathons = sqliteTable('hackathons', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  tagline: text('tagline'),
  description: text('description'),
  rules_md: text('rules_md'),
  status: text('status').notNull().default('draft'),
  starts_at: text('starts_at'),
  judging_starts: text('judging_starts'),
  judging_ends: text('judging_ends'),
  min_team_size: integer('min_team_size').notNull().default(1),
  max_team_size: integer('max_team_size').notNull().default(5),
  max_teams: integer('max_teams'),
  submission_tag_pattern: text('submission_tag_pattern').notNull().default('submission_v%'),
  allow_resubmission: integer('allow_resubmission').notNull().default(0),
  allow_registration_during_active: integer('allow_registration_during_active').notNull().default(0),
  notify_all_on_deadline: integer('notify_all_on_deadline').notNull().default(0),
  show_judge_comments_to_participants: integer('show_judge_comments_to_participants').notNull().default(0),
  registration_mode: text('registration_mode').notNull().default('open'),
  allowed_email_domains: text('allowed_email_domains').notNull().default('[]'),
  require_repo: integer('require_repo').notNull().default(1),
  timezone: text('timezone').notNull().default('UTC'),
  template_id: text('template_id'),
  tracks: text('tracks').notNull().default('[]'),
  prizes: text('prizes').notNull().default('[]'),
  settings: text('settings').notNull().default('{}'),
  created_by: text('created_by').notNull().references(() => user.id),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => ({
  workspaceIdx: index('idx_hackathons_workspace').on(table.workspace_id),
  statusIdx: index('idx_hackathons_status').on(table.status),
}));
