import { z } from 'zod';

export const assignJudgeTrackSchema = z.object({
  track_ids: z.array(z.string().uuid()).min(1),
});

export type AssignJudgeTrack = z.infer<typeof assignJudgeTrackSchema>;
