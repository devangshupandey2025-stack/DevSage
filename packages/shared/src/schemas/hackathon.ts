import { z } from 'zod';
import { hackathonStatusSchema } from './constants.js';

export const createHackathonSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  submission_deadline: z.string().datetime().optional(),
  max_team_size: z.number().int().min(1).max(50).default(5),
  min_team_size: z.number().int().min(1).default(1),
  max_teams: z.number().int().min(1).optional(),
  settings: z.record(z.unknown()).optional(),
  template_id: z.string().uuid().optional(),
});

export const updateHackathonSchema = createHackathonSchema.partial().omit({ slug: true });

export const transitionHackathonSchema = z.object({
  target_status: hackathonStatusSchema,
  version: z.number().int(),
});

export const hackathonResponseSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  status: hackathonStatusSchema,
  start_date: z.string().datetime().nullable(),
  end_date: z.string().datetime().nullable(),
  submission_deadline: z.string().datetime().nullable(),
  max_team_size: z.number(),
  min_team_size: z.number(),
  max_teams: z.number().nullable(),
  settings: z.record(z.unknown()).nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CreateHackathon = z.infer<typeof createHackathonSchema>;
export type UpdateHackathon = z.infer<typeof updateHackathonSchema>;
export type TransitionHackathon = z.infer<typeof transitionHackathonSchema>;
export type HackathonResponse = z.infer<typeof hackathonResponseSchema>;
