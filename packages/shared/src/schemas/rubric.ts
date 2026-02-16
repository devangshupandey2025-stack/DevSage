import { z } from 'zod';

export const createRubricCriterionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  max_score: z.number().int().min(1).max(100).default(10),
  weight: z.number().min(0).max(1),
  track_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const updateRubricCriterionSchema = createRubricCriterionSchema.partial();

export type CreateRubricCriterion = z.infer<typeof createRubricCriterionSchema>;
export type UpdateRubricCriterion = z.infer<typeof updateRubricCriterionSchema>;
