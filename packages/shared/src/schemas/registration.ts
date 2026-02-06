import { z } from 'zod';

export const RegistrationSchema = z.object({
  id: z.string().uuid(),
  hackathonId: z.string().uuid(),
  userId: z.string().uuid(),
  registeredAt: z.string().datetime(),
});

export type Registration = z.infer<typeof RegistrationSchema>;
