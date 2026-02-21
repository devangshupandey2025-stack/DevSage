import { z } from 'zod';
import { teamMemberRoleSchema } from './constants.js';

export const teamMemberResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: teamMemberRoleSchema,
  joined_at: z.string().datetime(),
  user: z.object({
    name: z.string(),
    email: z.string().email(),
    github_username: z.string().nullable(),
    avatar_url: z.string().url().nullable(),
  }).optional(),
});

export type TeamMemberResponse = z.infer<typeof teamMemberResponseSchema>;
