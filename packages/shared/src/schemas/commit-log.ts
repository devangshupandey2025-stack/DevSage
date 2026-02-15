import { z } from 'zod';

export const CommitLogSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  teamId: z.string(),
  deliveryId: z.string().nullable().optional(),
  sha: z.string(),
  message: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
  committedAt: z.string(),
  url: z.string(),
  branch: z.string(),
  filesAdded: z.number().int(),
  filesModified: z.number().int(),
  filesRemoved: z.number().int(),
  provider: z.string(),
  createdAt: z.string(),
});

export type CommitLog = z.infer<typeof CommitLogSchema>;
