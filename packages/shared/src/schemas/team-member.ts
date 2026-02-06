import { z } from 'zod';

export const TeamMemberSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  joinedAt: z.string().datetime(),
});

export type TeamMember = z.infer<typeof TeamMemberSchema>;
