import { z } from 'zod';

export const TeamMemberRoleEnum = z.enum(['leader', 'member']);

export type TeamMemberRole = z.infer<typeof TeamMemberRoleEnum>;

export const TeamMemberSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string(),
  role: TeamMemberRoleEnum,
  joinedAt: z.string(),
});

export type TeamMember = z.infer<typeof TeamMemberSchema>;
