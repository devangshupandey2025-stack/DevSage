import { z } from 'zod';

export const notificationResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  read_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
