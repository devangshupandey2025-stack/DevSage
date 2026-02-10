import { z } from 'zod';

export const RubricCriteriaSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  maxScore: z.number().int(),
  weight: z.number(),
  sortOrder: z.number().int(),
});

export type RubricCriteria = z.infer<typeof RubricCriteriaSchema>;
