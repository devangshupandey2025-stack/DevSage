import { z } from 'zod';

export const submitScoreSchema = z.object({
  scores: z.array(z.object({
    criterion_id: z.string().uuid(),
    score: z.number().min(0),
    notes: z.string().max(1000).optional(),
  })).min(1),
});

export type SubmitScore = z.infer<typeof submitScoreSchema>;
