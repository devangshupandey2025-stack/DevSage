import { z } from 'zod';

export const createRoundSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  round_number: z.number().int().min(1),
  submission_deadline: z.string().datetime().optional(),
  is_elimination: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

export const updateRoundSchema = createRoundSchema.partial();

export type CreateRound = z.infer<typeof createRoundSchema>;
export type UpdateRound = z.infer<typeof updateRoundSchema>;
