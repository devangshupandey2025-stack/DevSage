import { z } from 'zod';

export const SubmissionStatusEnum = z.enum([
  'received',
  'validated',
  'validation_failed',
  'locked',
  'under_review',
  'scored',
  'invalid',
  'superseded',
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
  provider: z.string(),
  repoFullName: z.string(),
  roundId: z.string(),
  status: SubmissionStatusEnum,
  demoUrl: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  isLate: z.number().int(),
  isFinal: z.number().int(),
  validationResults: z.string().nullable().optional(),
  lockedAt: z.string().nullable().optional(),
  finalizedAt: z.string().nullable().optional(),
  submittedAt: z.string(),
  receivedAt: z.string(),
  webhookDeliveryId: z.string().nullable().optional(),
});

export type Submission = z.infer<typeof SubmissionSchema>;
