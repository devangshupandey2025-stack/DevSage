import { z } from 'zod';

export const ForcePushSeverityEnum = z.enum(['info', 'warning', 'critical']);

export type ForcePushSeverity = z.infer<typeof ForcePushSeverityEnum>;

export const ForcePushEventSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  teamId: z.string(),
  deliveryId: z.string().nullable().optional(),
  repoFullName: z.string(),
  branch: z.string(),
  beforeSha: z.string(),
  afterSha: z.string(),
  estimatedLostCommits: z.number().int(),
  severity: ForcePushSeverityEnum,
  affectedSubmissionIds: z.string(),
  resolved: z.number().int(),
  resolvedBy: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
  resolutionNote: z.string().nullable().optional(),
  provider: z.string(),
  pusherLogin: z.string(),
  createdAt: z.string(),
});

export type ForcePushEvent = z.infer<typeof ForcePushEventSchema>;
