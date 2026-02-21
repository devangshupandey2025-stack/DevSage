import { z } from 'zod';

export const roundResultResponseSchema = z.object({
  id: z.string().uuid(),
  round_id: z.string().uuid(),
  team_id: z.string().uuid(),
  rank: z.number().int(),
  total_score: z.number(),
  advanced: z.boolean(),
  created_at: z.string().datetime(),
});

export type RoundResultResponse = z.infer<typeof roundResultResponseSchema>;
