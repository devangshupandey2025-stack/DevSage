import { z } from 'zod';

// Hackathon Request Schemas
export const CreateHackathonRequestSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(5000),
  registrationStartDate: z.string().datetime(),
  hackingStartDate: z.string().datetime(),
  submissionDeadline: z.string().datetime(),
  maxTeamSize: z.number().int().min(1).max(10),
});

export type CreateHackathonRequest = z.infer<typeof CreateHackathonRequestSchema>;

export const UpdateHackathonRequestSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(5000).optional(),
  registrationStartDate: z.string().datetime().optional(),
  hackingStartDate: z.string().datetime().optional(),
  submissionDeadline: z.string().datetime().optional(),
  maxTeamSize: z.number().int().min(1).max(10).optional(),
});

export type UpdateHackathonRequest = z.infer<typeof UpdateHackathonRequestSchema>;

// Team Request Schemas
export const CreateTeamRequestSchema = z.object({
  name: z.string().min(2).max(50),
  hackathonId: z.string().uuid(),
});

export type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>;

export const JoinTeamRequestSchema = z.object({
  joinCode: z.string().length(8),
});

export type JoinTeamRequest = z.infer<typeof JoinTeamRequestSchema>;
