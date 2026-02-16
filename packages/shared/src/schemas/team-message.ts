import { z } from 'zod';

export const TeamMessageSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string(),
  content: z.string().min(1).max(2000),
  createdAt: z.string(),
});

export type TeamMessage = z.infer<typeof TeamMessageSchema>;

export const CreateTeamMessageRequestSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type CreateTeamMessageRequest = z.infer<typeof CreateTeamMessageRequestSchema>;
