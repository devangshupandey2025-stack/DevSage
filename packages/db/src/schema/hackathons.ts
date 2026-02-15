import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';
import { workspaces } from './workspaces.js';
import { hackathonTemplates } from './hackathon-templates.js';

export const hackathons = sqliteTable('hackathons', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  tagline: text('tagline'),
  description: text('description'),
  rules_md: text('rules_md'),
  status: text('status', {
    enum: ['draft', 'active', 'judging', 'completed', 'archived']
  }).notNull().default('draft'),
  starts_at: text('starts_at'),
  judging_starts: text('judging_starts'),
  judging_ends: text('judging_ends'),

  // Team config
  min_team_size: integer('min_team_size').notNull().default(1),
  max_team_size: integer('max_team_size').notNull().default(5),
  max_teams: integer('max_teams'),
  allow_solo: integer('allow_solo').notNull().default(1),

  // Submission config
  submission_tag_pattern: text('submission_tag_pattern').notNull().default('submission_v%'),
  allow_resubmission: integer('allow_resubmission').notNull().default(0),
  submission_deadline: text('submission_deadline'),
  max_submissions_per_team: integer('max_submissions_per_team'),
  allow_late_submissions: integer('allow_late_submissions').notNull().default(0),
  require_readme: integer('require_readme').notNull().default(0),
  require_demo_url: integer('require_demo_url').notNull().default(0),

  // Registration & notifications
  allow_registration_during_active: integer('allow_registration_during_active').notNull().default(0),
  notify_all_on_deadline: integer('notify_all_on_deadline').notNull().default(0),

  // Judging config
  show_judge_comments_to_participants: integer('show_judge_comments_to_participants').notNull().default(0),
  judges_per_submission: integer('judges_per_submission').notNull().default(2),
  enable_ai_reviews: integer('enable_ai_reviews').notNull().default(1),
  blind_judging: integer('blind_judging').notNull().default(0),
  enable_audience_voting: integer('enable_audience_voting').notNull().default(0),

  // Registration
  registration_mode: text('registration_mode', {
    enum: ['open', 'domain_restricted', 'approval_based']
  }).notNull().default('open'),
  allowed_email_domains: text('allowed_email_domains').notNull().default('[]'),
  require_repo: integer('require_repo').notNull().default(1),
  timezone: text('timezone').notNull().default('UTC'),

  // Template & cloning
  template_id: text('template_id').references(() => hackathonTemplates.id),
  cloned_from_id: text('cloned_from_id'),
  track_assignment_mode: text('track_assignment_mode', {
    enum: ['organizer_assigned', 'team_choice']
  }).notNull().default('team_choice'),
  landing_page_public: integer('landing_page_public').notNull().default(1),

  // JSON config
  tracks: text('tracks').notNull().default('[]'),
  prizes: text('prizes').notNull().default('[]'),
  settings: text('settings').notNull().default('{}'),

  // Branding
  primary_color: text('primary_color').notNull().default('#6366f1'),
  secondary_color: text('secondary_color'),
  logo_r2_key: text('logo_r2_key'),
  banner_r2_key: text('banner_r2_key'),
  favicon_r2_key: text('favicon_r2_key'),
  custom_css: text('custom_css'),

  // Metadata
  created_by: text('created_by').notNull().references(() => users.id),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => ({
  idxHackathonsWorkspace: index('idx_hackathons_workspace').on(table.workspace_id),
  idxHackathonsStatus: index('idx_hackathons_status').on(table.status),
  idxHackathonsCreatedBy: index('idx_hackathons_created_by').on(table.created_by),
  idxHackathonsSubmissionDeadline: index('idx_hackathons_submission_deadline').on(table.submission_deadline),
  idxHackathonsStartsAt: index('idx_hackathons_starts_at').on(table.starts_at),
}));
