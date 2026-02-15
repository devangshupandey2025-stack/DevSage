import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  githubId: z.number().int(),
  googleId: z.string().nullable().optional(),
  githubUsername: z.string(),
  displayName: z.string(),
  email: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  emailVerified: z.number().int(),
  emailBounced: z.number().int(),
  suspended: z.number().int(),
  suspendedAt: z.string().nullable().optional(),
  suspendedReason: z.string().nullable().optional(),
  lastLoginAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type User = z.infer<typeof UserSchema>;
