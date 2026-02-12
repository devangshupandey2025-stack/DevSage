import { z } from 'zod';
import { HackathonStatusEnum } from './hackathon.js';

export const CreateTeamRequestSchema = z.object({
  name: z.string().min(2).max(50),
});

export type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>;

export const JoinTeamRequestSchema = z.object({
  inviteCode: z.string(),
});

export type JoinTeamRequest = z.infer<typeof JoinTeamRequestSchema>;

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const StatusTransitionRequestSchema = z.object({
  targetStatus: HackathonStatusEnum,
  expectedVersion: z.number().int().positive().optional(),
});

export type StatusTransitionRequest = z.infer<typeof StatusTransitionRequestSchema>;

export const ApiErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiSuccessSchema = z.object({
  ok: z.literal(true),
  data: z.unknown().optional(),
  meta: z.record(z.unknown()).optional(),
});

export type ApiSuccess = z.infer<typeof ApiSuccessSchema>;
