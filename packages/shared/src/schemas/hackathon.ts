import { z } from 'zod';

export const HackathonStatusEnum = z.enum([
  'draft',
  'registration_open',
  'registration_closed',
  'active',
  'judging',
  'completed',
  'archived',
]);

export type HackathonStatus = z.infer<typeof HackathonStatusEnum>;

export const HackathonSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(5000),
  organizerId: z.string().uuid(),
  status: HackathonStatusEnum,
  maxTeamSize: z.number().int().min(1).max(10),
  registrationStartDate: z.string().datetime(),
  hackingStartDate: z.string().datetime(),
  submissionDeadline: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Hackathon = z.infer<typeof HackathonSchema>;
