import { z } from 'zod';

export const TeamInviteStatusEnum = z.enum(['pending', 'accepted', 'expired']);

export type TeamInviteStatus = z.infer<typeof TeamInviteStatusEnum>;

export const TeamInviteSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  email: z.string().email(),
  tokenHash: z.string(),
  status: TeamInviteStatusEnum,
  createdAt: z.string(),
});

export type TeamInvite = z.infer<typeof TeamInviteSchema>;

export const CreateTeamInviteRequestSchema = z.object({
  email: z.string().email(),
});

export type CreateTeamInviteRequest = z.infer<typeof CreateTeamInviteRequestSchema>;
