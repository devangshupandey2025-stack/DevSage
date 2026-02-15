import { z } from 'zod';

export const RoundResultStatusEnum = z.enum(['advanced', 'eliminated']);

export type RoundResultStatus = z.infer<typeof RoundResultStatusEnum>;

export const RoundResultSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  roundId: z.string(),
  teamId: z.string(),
  status: RoundResultStatusEnum,
  rank: z.number().int().nullable().optional(),
  totalScore: z.number().nullable().optional(),
  decidedBy: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type RoundResult = z.infer<typeof RoundResultSchema>;
