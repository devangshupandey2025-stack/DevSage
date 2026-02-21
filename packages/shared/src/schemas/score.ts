import { z } from 'zod';

export const submitScoreSchema = z.object({
  scores: z.array(z.object({
    criteria_id: z.string().uuid(),
    score: z.number().min(0),
    comment: z.string().max(1000).optional(),
    assignment_id: z.string().uuid(),
    round: z.number().int().min(1).optional(),
  })).min(1),
});

export type SubmitScore = z.infer<typeof submitScoreSchema>;
