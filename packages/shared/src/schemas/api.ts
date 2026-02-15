import { z } from 'zod';
import { HackathonStatusEnum } from './hackathon.js';

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const StatusTransitionRequestSchema = z.object({
  targetStatus: HackathonStatusEnum,
});

export type StatusTransitionRequest = z.infer<typeof StatusTransitionRequestSchema>;

export const ApiErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiSuccessSchema = z.object({
  ok: z.literal(true),
  data: z.unknown().optional(),
  meta: z.record(z.unknown()).optional(),
});

export type ApiSuccess = z.infer<typeof ApiSuccessSchema>;
