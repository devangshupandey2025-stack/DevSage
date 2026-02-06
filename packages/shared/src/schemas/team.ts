import { z } from 'zod';

export const TeamSchema = z.object({
  id: z.string().uuid(),
  hackathonId: z.string().uuid(),
  name: z.string().min(2).max(50),
  joinCode: z.string().length(8),
  captainId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type Team = z.infer<typeof TeamSchema>;
