import { z } from 'zod';

export const OrganizerRoleEnum = z.enum(['organizer', 'co_organizer']);

export type OrganizerRoleType = z.infer<typeof OrganizerRoleEnum>;

export const OrganizerRoleSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  userId: z.string(),
  role: OrganizerRoleEnum,
  createdAt: z.string(),
});

export type OrganizerRole = z.infer<typeof OrganizerRoleSchema>;
