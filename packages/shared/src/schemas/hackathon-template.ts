import { z } from 'zod';

export const HackathonTemplateSchema = z.object({
  id: z.string(),
  workspaceId: z.string().nullable().optional(),
  name: z.string(),
  description: z.string(),
  configSnapshot: z.string(),
  rubricSnapshot: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type HackathonTemplate = z.infer<typeof HackathonTemplateSchema>;
