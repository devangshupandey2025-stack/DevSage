import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  githubId: z.number().int(),
  googleId: z.string().nullable().optional(),
  githubUsername: z.string(),
  displayName: z.string(),
  email: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type User = z.infer<typeof UserSchema>;
