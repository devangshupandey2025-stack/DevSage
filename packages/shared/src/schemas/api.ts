import { z } from 'zod';
import { HackathonStatusEnum, HackathonSchema } from './hackathon.js';
import { TeamSchema } from './team.js';
import { SubmissionSchema } from './submission.js';

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

// Hackathon Response Schemas
export const HackathonResponseSchema = HackathonSchema;
export type HackathonResponse = z.infer<typeof HackathonResponseSchema>;

export const HackathonListResponseSchema = z.object({
  data: z.array(HackathonSchema),
  total: z.number().int().nonnegative(),
});

export type HackathonListResponse = z.infer<typeof HackathonListResponseSchema>;

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

// Team Response Schemas
export const TeamResponseSchema = TeamSchema;
export type TeamResponse = z.infer<typeof TeamResponseSchema>;

export const TeamListResponseSchema = z.object({
  data: z.array(TeamSchema),
  total: z.number().int().nonnegative(),
});

export type TeamListResponse = z.infer<typeof TeamListResponseSchema>;

// Registration Request Schema
export const RegisterForHackathonRequestSchema = z.object({
  hackathonId: z.string().uuid(),
});

export type RegisterForHackathonRequest = z.infer<typeof RegisterForHackathonRequestSchema>;

// Submission Response Schemas
export const SubmissionResponseSchema = SubmissionSchema;
export type SubmissionResponse = z.infer<typeof SubmissionResponseSchema>;

export const SubmissionListResponseSchema = z.object({
  data: z.array(SubmissionSchema),
  total: z.number().int().nonnegative(),
});

export type SubmissionListResponse = z.infer<typeof SubmissionListResponseSchema>;

// Error Response Schema
export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
