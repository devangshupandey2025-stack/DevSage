import { z } from 'zod';

export const CreateTeamRequestSchema = z.object({
  name: z.string().min(2).max(50),
  hackathonId: z.string(),
});

export type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>;

export const JoinTeamRequestSchema = z.object({
  inviteCode: z.string(),
});

export type JoinTeamRequest = z.infer<typeof JoinTeamRequestSchema>;

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
