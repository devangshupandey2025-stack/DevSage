import { z } from 'zod';

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  avatar_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;

export const registerRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
