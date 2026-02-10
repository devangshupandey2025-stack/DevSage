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

export const BulkRubricRequestSchema = z.object({
  criteria: z.array(
    z.object({
      name: z.string().min(1, 'Name is required'),
      description: z.string().optional(),
      maxScore: z.number().int().positive('Max score must be positive'),
      weight: z.number().min(0).max(1, 'Weight must be between 0 and 1'),
      sortOrder: z.number().int().nonnegative('Sort order must be nonnegative'),
    }),
  ),
});

export type BulkRubricRequest = z.infer<typeof BulkRubricRequestSchema>;
