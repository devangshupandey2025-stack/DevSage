import { z } from 'zod';

export const inviteJudgeSchema = z.object({
  email: z.string().email(),
});

export const bulkInviteJudgesSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(50),
});

export type InviteJudge = z.infer<typeof inviteJudgeSchema>;
export type BulkInviteJudges = z.infer<typeof bulkInviteJudgesSchema>;
