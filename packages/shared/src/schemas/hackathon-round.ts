import { z } from 'zod';

export const RoundStatusEnum = z.enum(['pending', 'active', 'judging', 'completed']);

export type RoundStatus = z.infer<typeof RoundStatusEnum>;

export const HackathonRoundSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  roundNumber: z.number().int(),
  name: z.string(),
  type: z.string(),
  status: RoundStatusEnum,
  submissionDeadline: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type HackathonRound = z.infer<typeof HackathonRoundSchema>;
