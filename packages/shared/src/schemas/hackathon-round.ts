import { z } from 'zod';

export const RoundTypeEnum = z.enum(['normal', 'elimination']);

export type RoundType = z.infer<typeof RoundTypeEnum>;

export const RoundStatusEnum = z.enum(['pending', 'active', 'judging', 'completed']);

export type RoundStatus = z.infer<typeof RoundStatusEnum>;

export const HackathonRoundSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  roundNumber: z.number().int(),
  name: z.string(),
  type: RoundTypeEnum,
  status: RoundStatusEnum,
  submissionDeadline: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type HackathonRound = z.infer<typeof HackathonRoundSchema>;

export const CreateRoundRequestSchema = z.object({
  name: z.string().min(1).max(200),
  type: RoundTypeEnum.default('normal'),
  submissionDeadline: z.string().optional(),
});

export type CreateRoundRequest = z.infer<typeof CreateRoundRequestSchema>;

export const UpdateRoundRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: RoundTypeEnum.optional(),
  submissionDeadline: z.string().nullable().optional(),
});

export type UpdateRoundRequest = z.infer<typeof UpdateRoundRequestSchema>;

export const TransitionRoundStatusSchema = z.object({
  status: RoundStatusEnum,
});

export type TransitionRoundStatus = z.infer<typeof TransitionRoundStatusSchema>;
