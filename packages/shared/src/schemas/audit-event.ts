import { z } from 'zod';

export const ActorTypeEnum = z.enum(['user', 'system', 'bot', 'cron']);

export type ActorType = z.infer<typeof ActorTypeEnum>;

export const AuditEventSchema = z.object({
  id: z.string(),
  sequence: z.number().int(),
  hackathonId: z.string().nullable().optional(),
  actorId: z.string().nullable().optional(),
  actorType: ActorTypeEnum,
  actorIp: z.string().nullable().optional(),
  actorUserAgent: z.string().nullable().optional(),
  eventType: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  teamId: z.string().nullable().optional(),
  metadata: z.string(),
  changes: z.string().nullable().optional(),
  hash: z.string(),
  prevHash: z.string().nullable().optional(),
  anonymizedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
