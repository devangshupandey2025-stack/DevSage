import { z } from 'zod';

export const JudgeTrackSchema = z.object({
  id: z.string(),
  judgeId: z.string(),
  trackId: z.string(),
});

export type JudgeTrack = z.infer<typeof JudgeTrackSchema>;
