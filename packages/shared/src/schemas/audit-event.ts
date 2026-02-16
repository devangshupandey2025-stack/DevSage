import { z } from 'zod';
import { auditActorTypeSchema } from './constants.js';

export const auditEventResponseSchema = z.object({
  id: z.string().uuid(),
  hackathon_id: z.string().uuid().nullable(),
  actor_id: z.string().uuid().nullable(),
  actor_type: auditActorTypeSchema,
  event_type: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  changes: z.record(z.unknown()).nullable(),
  created_at: z.string().datetime(),
});

export const auditQuerySchema = z.object({
  event_type: z.string().optional(),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  actor_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type AuditEventResponse = z.infer<typeof auditEventResponseSchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
