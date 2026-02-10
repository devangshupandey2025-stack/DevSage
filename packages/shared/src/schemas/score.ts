import { z } from 'zod';

export const ScoreSchema = z.object({
  id: z.string(),
  submissionId: z.string(),
  judgeId: z.string(),
  criteriaId: z.string(),
  score: z.number().int().min(0),
  comment: z.string().nullable().optional(),
  scoredAt: z.string(),
});

export type Score = z.infer<typeof ScoreSchema>;
