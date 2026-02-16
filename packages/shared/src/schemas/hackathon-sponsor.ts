import { z } from 'zod';
import { sponsorTierSchema } from './constants.js';

export const createSponsorSchema = z.object({
  name: z.string().min(1).max(200),
  tier: sponsorTierSchema,
  logo_url: z.string().url().optional(),
  website_url: z.string().url().optional(),
  description: z.string().max(1000).optional(),
  sort_order: z.number().int().default(0),
});

export const updateSponsorSchema = createSponsorSchema.partial();

export type CreateSponsor = z.infer<typeof createSponsorSchema>;
export type UpdateSponsor = z.infer<typeof updateSponsorSchema>;
