import { z } from 'zod';

export const TeamSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  name: z.string(),
  description: z.string(),
  inviteCode: z.string().nullable().optional(),
  trackId: z.string().nullable().optional(),
  ready: z.number().int(),
  memberCount: z.number().int().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Team = z.infer<typeof TeamSchema>;

export const CreateTeamRequestSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
  trackId: z.string().optional(),
});

export type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>;

export const JoinTeamRequestSchema = z.object({
  inviteCode: z.string(),
});

export type JoinTeamRequest = z.infer<typeof JoinTeamRequestSchema>;

