import { z } from 'zod';

export const CommitLogSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  hackathonId: z.string(),
  commitSha: z.string(),
  message: z.string().nullable().optional(),
  authorUsername: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  pushedAt: z.string(),
  isForcePush: z.number().int(),
  commitsInPush: z.number().int().nullable().optional(),
  webhookDeliveryId: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type CommitLog = z.infer<typeof CommitLogSchema>;
