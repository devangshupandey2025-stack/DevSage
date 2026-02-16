import { z } from 'zod';
import { authProviderSchema } from './constants.js';

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  github_username: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  auth_provider: authProviderSchema,
  created_at: z.string().datetime(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
