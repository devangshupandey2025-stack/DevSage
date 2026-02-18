import { queryOptions } from '@tanstack/react-query';
import { apiRequest } from './api';

// ── Types ──────────────────────────────────────────────────────────

interface Hackathon {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  status: string;
  max_team_size: number;
  min_team_size: number;
  submission_tag_pattern: string;
  registration_open: boolean;
  starts_at: string | null;
  submission_deadline: string | null;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
}

interface Team {
  id: string;
  hackathon_id: string;
  name: string;
  invite_code: string;
  status: string;
  created_by: string;
  created_at: string;
  members?: TeamMember[];
}

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: string;
  display_name: string;
  avatar_url: string | null;
  joined_at: string;
}

interface Submission {
  id: string;
  team_id: string;
  round_id: string | null;
  tag_name: string;
  commit_sha: string;
  status: string;
  submitted_at: string;
  is_current: boolean;
  team_name?: string;
  repo_url?: string;
}

interface Judge {
  id: string;
  user_id: string;
  hackathon_id: string;
  status: string;
  display_name: string;
  avatar_url: string | null;
  invited_at: string;
  accepted_at: string | null;
}

interface RubricCriterion {
  id: string;
  hackathon_id: string;
  name: string;
  description: string | null;
  max_score: number;
  weight: number;
  sort_order: number;
}

interface LeaderboardEntry {
  rank: number;
  team_id: string;
  team_name: string;
  total_score: number;
  judges_scored: number;
  criteria_scores?: { name: string; average: number; weighted: number }[];
}

interface AuditEvent {
  id: string;
  hackathon_id: string | null;
  actor_type: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface JudgeAssignment {
  id: string;
  judge_id: string;
  submission_id: string;
  status: string;
  team_name: string;
  team_id: string;
  tag_name: string;
  hackathon_slug: string;
}

// ── API Response Wrappers ──────────────────────────────────────────

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  meta?: unknown;
}

interface PaginatedResponse<T> {
  ok: boolean;
  data: T[];
  meta: { total: number; limit: number; offset: number; has_more: boolean };
}

// ── Query Factories ────────────────────────────────────────────────

export const hackathonQueries = {
  all: () =>
    queryOptions({
      queryKey: ['hackathons'],
      queryFn: () => apiRequest<ApiResponse<Hackathon[]>>('/api/v1/hackathons'),
    }),
  detail: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug],
      queryFn: () => apiRequest<ApiResponse<Hackathon>>(`/api/v1/hackathons/${slug}`),
      enabled: !!slug,
    }),
  teams: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug, 'teams'],
      queryFn: () => apiRequest<ApiResponse<Team[]>>(`/api/v1/hackathons/${slug}/teams`),
      enabled: !!slug,
    }),
  teamDetail: (slug: string, teamId: string) =>
    queryOptions({
      queryKey: ['hackathons', slug, 'teams', teamId],
      queryFn: () => apiRequest<ApiResponse<Team>>(`/api/v1/hackathons/${slug}/teams/${teamId}`),
      enabled: !!slug && !!teamId,
    }),
  submissions: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug, 'submissions'],
      queryFn: () => apiRequest<ApiResponse<Submission[]>>(`/api/v1/hackathons/${slug}/submissions`),
      enabled: !!slug,
    }),
  judges: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug, 'judges'],
      queryFn: () => apiRequest<ApiResponse<Judge[]>>(`/api/v1/hackathons/${slug}/judges`),
      enabled: !!slug,
    }),
  rubric: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug, 'rubric'],
      queryFn: () => apiRequest<ApiResponse<RubricCriterion[]>>(`/api/v1/hackathons/${slug}/rubric`),
      enabled: !!slug,
    }),
  leaderboard: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug, 'leaderboard'],
      queryFn: () => apiRequest<ApiResponse<LeaderboardEntry[]>>(`/api/v1/hackathons/${slug}/leaderboard`),
      enabled: !!slug,
    }),
  audit: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug, 'audit'],
      queryFn: () => apiRequest<ApiResponse<AuditEvent[]>>(`/api/v1/hackathons/${slug}/audit`),
      enabled: !!slug,
    }),
};

export const judgeQueries = {
  assignments: () =>
    queryOptions({
      queryKey: ['judge', 'assignments'],
      queryFn: () => apiRequest<ApiResponse<JudgeAssignment[]>>('/api/v1/judge/assignments'),
    }),
};

export const notificationQueries = {
  all: () =>
    queryOptions({
      queryKey: ['notifications'],
      queryFn: () => apiRequest<ApiResponse<unknown[]>>('/api/v1/notifications'),
    }),
  unreadCount: () =>
    queryOptions({
      queryKey: ['notifications', 'unread-count'],
      queryFn: () => apiRequest<ApiResponse<{ count: number }>>('/api/v1/notifications/unread-count'),
    }),
};

interface Round {
  id: string;
  hackathon_id: string;
  name: string;
  round_number: number;
  type: string | null;
  status: string;
  is_initialized: number;
  submission_deadline: string | null;
  created_at: string;
}

interface Organizer {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export const roundQueries = {
  list: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug, 'rounds'],
      queryFn: () => apiRequest<ApiResponse<Round[]>>(`/api/v1/hackathons/${slug}/rounds`),
      enabled: !!slug,
    }),
};

export const organizerQueries = {
  list: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug, 'organizers'],
      queryFn: () => apiRequest<ApiResponse<Organizer[]>>(`/api/v1/hackathons/${slug}/organizers`),
      enabled: !!slug,
    }),
};

// Re-export types for use in components
export type {
  Hackathon,
  Team,
  TeamMember,
  Submission,
  Judge,
  RubricCriterion,
  LeaderboardEntry,
  AuditEvent,
  JudgeAssignment,
  Round,
  Organizer,
  ApiResponse,
  PaginatedResponse,
};
