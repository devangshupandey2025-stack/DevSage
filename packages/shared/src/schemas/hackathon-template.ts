import { z } from 'zod';

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  settings: z.record(z.unknown()).default({}),
  tracks: z.array(z.record(z.unknown())).default([]),
  rounds: z.array(z.record(z.unknown())).default([]),
  rubric: z.array(z.record(z.unknown())).default([]),
  is_platform_default: z.boolean().default(false),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export type CreateTemplate = z.infer<typeof createTemplateSchema>;
export type UpdateTemplate = z.infer<typeof updateTemplateSchema>;
