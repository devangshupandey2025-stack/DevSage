import { z } from 'zod';
import { teamStatusSchema } from './constants.js';

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  track_id: z.string().uuid().optional(),
});

export const joinTeamSchema = z.object({
  invite_code: z.string().length(8),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  track_id: z.string().uuid().nullable().optional(),
});

export const transferLeadershipSchema = z.object({
  new_leader_id: z.string().uuid(),
});

export const teamResponseSchema = z.object({
  id: z.string().uuid(),
  hackathon_id: z.string().uuid(),
  name: z.string(),
  invite_code: z.string(),
  track_id: z.string().uuid().nullable(),
  status: teamStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CreateTeam = z.infer<typeof createTeamSchema>;
export type JoinTeam = z.infer<typeof joinTeamSchema>;
export type UpdateTeam = z.infer<typeof updateTeamSchema>;
export type TransferLeadership = z.infer<typeof transferLeadershipSchema>;
export type TeamResponse = z.infer<typeof teamResponseSchema>;
