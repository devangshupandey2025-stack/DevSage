import { z } from 'zod';

export const ActorTypeEnum = z.enum(['user', 'system', 'bot', 'cron']);

export type ActorType = z.infer<typeof ActorTypeEnum>;

export const AuditEventSchema = z.object({
  id: z.string(),
  hackathonId: z.string().nullable().optional(),
  actorId: z.string().nullable().optional(),
  actorType: ActorTypeEnum,
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  details: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
