import { z } from 'zod';

export const forcePushResponseSchema = z.object({
  id: z.string().uuid(),
  before_sha: z.string(),
  after_sha: z.string(),
  ref: z.string(),
  pusher_login: z.string(),
  detected_at: z.string().datetime(),
});

export type ForcePushResponse = z.infer<typeof forcePushResponseSchema>;
