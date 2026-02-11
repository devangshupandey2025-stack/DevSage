import { z } from 'zod';

export const ForcePushActionEnum = z.enum(['logged', 'warned', 'flagged']);

export type ForcePushAction = z.infer<typeof ForcePushActionEnum>;

export const ForcePushEventSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  hackathonId: z.string(),
  beforeSha: z.string(),
  afterSha: z.string(),
  branch: z.string(),
  commitsLostShas: z.string().nullable().optional(),
  commitsLostCount: z.number().int().nullable().optional(),
  detectedAt: z.string(),
  notifiedOrganizer: z.number().int(),
  actionTaken: ForcePushActionEnum.nullable().optional(),
  submissionsInvalidated: z.string().nullable().optional(),
  webhookDeliveryId: z.string().nullable().optional(),
});

export type ForcePushEvent = z.infer<typeof ForcePushEventSchema>;
