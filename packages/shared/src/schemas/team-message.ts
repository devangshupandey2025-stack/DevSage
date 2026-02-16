import { z } from 'zod';

export const teamMessageResponseSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  user_id: z.string().uuid(),
  content: z.string(),
  created_at: z.string().datetime(),
});

export type TeamMessageResponse = z.infer<typeof teamMessageResponseSchema>;
