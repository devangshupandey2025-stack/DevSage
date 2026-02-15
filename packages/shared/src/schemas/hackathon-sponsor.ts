import { z } from 'zod';

export const HackathonSponsorSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  name: z.string(),
  tier: z.string(),
  logoR2Key: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  description: z.string(),
  sortOrder: z.number().int(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type HackathonSponsor = z.infer<typeof HackathonSponsorSchema>;
