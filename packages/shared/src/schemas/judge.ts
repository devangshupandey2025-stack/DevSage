import { z } from 'zod';

export const JudgeInviteStatusEnum = z.enum(['pending', 'accepted', 'declined']);

export type JudgeInviteStatus = z.infer<typeof JudgeInviteStatusEnum>;

export const JudgeSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  userId: z.string(),
  inviteStatus: JudgeInviteStatusEnum,
  invitedAt: z.string(),
  acceptedAt: z.string().nullable().optional(),
});

export type Judge = z.infer<typeof JudgeSchema>;

export const InviteJudgeRequestSchema = z.object({
  userId: z.string().uuid(),
});

export const RespondToJudgeInviteRequestSchema = z.object({
  accept: z.boolean(),
});
