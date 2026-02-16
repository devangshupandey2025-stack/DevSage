import { z } from 'zod';
import { organizerRoleSchema } from './constants.js';

export const addOrganizerSchema = z.object({
  user_id: z.string().uuid(),
  role: organizerRoleSchema,
});

export type AddOrganizer = z.infer<typeof addOrganizerSchema>;
