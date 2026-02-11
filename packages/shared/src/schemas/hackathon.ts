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
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  rulesMd: z.string().nullable().optional(),
  registrationOpens: z.string(),
  registrationCloses: z.string(),
  submissionDeadline: z.string(),
  judgingStarts: z.string().nullable().optional(),
  judgingEnds: z.string().nullable().optional(),
  minTeamSize: z.number().int(),
  maxTeamSize: z.number().int(),
  maxTeams: z.number().int().nullable().optional(),
  submissionTagPattern: z.string(),
  maxSubmissionsPerTeam: z.number().int().nullable().optional(),
  allowLateSubmissions: z.number().int(),
  primaryColor: z.string().nullable().optional(),
  logoR2Key: z.string().nullable().optional(),
  bannerR2Key: z.string().nullable().optional(),
  customSubdomain: z.string().nullable().optional(),
  status: HackathonStatusEnum,
  createdBy: z.string(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export type Hackathon = z.infer<typeof HackathonSchema>;

export const CreateHackathonRequestSchema = z.object({
  slug: z.string().min(3).max(60),
  title: z.string().min(3).max(100),
  description: z.string().max(5000).optional(),
  rulesMd: z.string().optional(),
  registrationOpens: z.string(),
  registrationCloses: z.string(),
  submissionDeadline: z.string(),
  judgingStarts: z.string().optional(),
  judgingEnds: z.string().optional(),
  minTeamSize: z.number().int().min(1).optional(),
  maxTeamSize: z.number().int().min(1).optional(),
  maxTeams: z.number().int().min(1).optional(),
  submissionTagPattern: z.string().optional(),
  maxSubmissionsPerTeam: z.number().int().min(1).optional(),
  allowLateSubmissions: z.number().int().min(0).max(1).optional(),
  primaryColor: z.string().optional(),
});

export type CreateHackathonRequest = z.infer<typeof CreateHackathonRequestSchema>;

export const UpdateHackathonRequestSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(5000).optional(),
  rulesMd: z.string().optional(),
  registrationOpens: z.string().optional(),
  registrationCloses: z.string().optional(),
  submissionDeadline: z.string().optional(),
  judgingStarts: z.string().optional(),
  judgingEnds: z.string().optional(),
  minTeamSize: z.number().int().min(1).optional(),
  maxTeamSize: z.number().int().min(1).optional(),
  maxTeams: z.number().int().min(1).nullable().optional(),
  submissionTagPattern: z.string().optional(),
  maxSubmissionsPerTeam: z.number().int().min(1).nullable().optional(),
  allowLateSubmissions: z.number().int().min(0).max(1).optional(),
  primaryColor: z.string().optional(),
  logoR2Key: z.string().nullable().optional(),
  bannerR2Key: z.string().nullable().optional(),
  customSubdomain: z.string().nullable().optional(),
});

export type UpdateHackathonRequest = z.infer<typeof UpdateHackathonRequestSchema>;
