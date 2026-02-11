import { z } from 'zod';

export const SubmissionStatusEnum = z.enum([
  'received',
  'validated',
  'invalid',
  'locked',
  'under_review',
  'scored',
  'invalidated',
]);

export type SubmissionStatus = z.infer<typeof SubmissionStatusEnum>;

export const SubmissionSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  hackathonId: z.string(),
  tagName: z.string(),
  commitSha: z.string(),
  commitMessage: z.string().nullable().optional(),
  commitAuthor: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  submittedAt: z.string(),
  receivedAt: z.string(),
  isLate: z.number().int(),
  isFinal: z.number().int(),
  version: z.number().int(),
  status: SubmissionStatusEnum,
  validationErrors: z.string().nullable().optional(),
  lockedAt: z.string().nullable().optional(),
  webhookDeliveryId: z.string().nullable().optional(),
});

export type Submission = z.infer<typeof SubmissionSchema>;
