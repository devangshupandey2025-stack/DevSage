import { z } from 'zod';
import { hackathonStatusSchema } from './constants.js';

export const createHackathonSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  workspace_id: z.string().uuid(),
  tagline: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  rules_md: z.string().optional(),
  starts_at: z.string().datetime().optional(),
  judging_starts: z.string().datetime().optional(),
  judging_ends: z.string().datetime().optional(),
  max_team_size: z.number().int().min(1).max(50).default(5),
  min_team_size: z.number().int().min(1).default(1),
  max_teams: z.number().int().min(1).optional(),
  submission_tag_pattern: z.string().default('submission_v%'),
  allow_resubmission: z.number().int().min(0).max(1).default(0),
  allow_registration_during_active: z.number().int().min(0).max(1).default(0),
  notify_all_on_deadline: z.number().int().min(0).max(1).default(0),
  show_judge_comments_to_participants: z.number().int().min(0).max(1).default(0),
  registration_mode: z.enum(['open', 'invite_only', 'approval']).default('open'),
  allowed_email_domains: z.string().default('[]'),
  require_repo: z.number().int().min(0).max(1).default(1),
  timezone: z.string().default('UTC'),
  tracks: z.array(z.unknown()).optional(),
  prizes: z.array(z.unknown()).optional(),
  settings: z.record(z.unknown()).optional(),
  template_id: z.string().uuid().optional(),
});

export const updateHackathonSchema = createHackathonSchema
  .partial()
  .omit({ slug: true, workspace_id: true });

export const transitionHackathonSchema = z.object({
  target_status: hackathonStatusSchema,
  version: z.number().int(),
});

export const hackathonResponseSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  slug: z.string(),
  title: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  rules_md: z.string().nullable(),
  status: hackathonStatusSchema,
  starts_at: z.string().nullable(),
  judging_starts: z.string().nullable(),
  judging_ends: z.string().nullable(),
  min_team_size: z.number(),
  max_team_size: z.number(),
  max_teams: z.number().nullable(),
  submission_tag_pattern: z.string(),
  allow_resubmission: z.number(),
  allow_registration_during_active: z.number(),
  notify_all_on_deadline: z.number(),
  show_judge_comments_to_participants: z.number(),
  registration_mode: z.string(),
  allowed_email_domains: z.string(),
  require_repo: z.number(),
  timezone: z.string(),
  template_id: z.string().nullable(),
  tracks: z.string(),
  prizes: z.string(),
  settings: z.string(),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CreateHackathon = z.infer<typeof createHackathonSchema>;
export type UpdateHackathon = z.infer<typeof updateHackathonSchema>;
export type TransitionHackathon = z.infer<typeof transitionHackathonSchema>;
export type HackathonResponse = z.infer<typeof hackathonResponseSchema>;
