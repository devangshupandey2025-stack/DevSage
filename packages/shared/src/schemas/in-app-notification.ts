import { z } from 'zod';

export const InAppNotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  hackathonId: z.string().nullable().optional(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  icon: z.string(),
  actionUrl: z.string().nullable().optional(),
  actionLabel: z.string().nullable().optional(),
  metadata: z.string(),
  read: z.number().int(),
  readAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type InAppNotification = z.infer<typeof InAppNotificationSchema>;
