import { queryOptions } from '@tanstack/react-query';
import { apiRequest } from './api';

// ── Types ──────────────────────────────────────────────────────────

interface Hackathon {
  id: string;
  workspace_id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  status: string;
  starts_at: string | null;
  judging_starts: string | null;
  judging_ends: string | null;
  created_at: string;
  updated_at: string;
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

interface Notification {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

// ── API Response Wrappers ──────────────────────────────────────────

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  meta?: unknown;
}

// ── Query Factories ────────────────────────────────────────────────

export const hackathonQueries = {
  detail: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug],
      queryFn: () => apiRequest<ApiResponse<Hackathon>>(`/api/v1/hackathons/${slug}`),
      enabled: !!slug,
    }),
  rubric: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug, 'rubric'],
      queryFn: () => apiRequest<ApiResponse<RubricCriterion[]>>(`/api/v1/hackathons/${slug}/judging/rubric`),
      enabled: !!slug,
    }),
  leaderboard: (slug: string) =>
    queryOptions({
      queryKey: ['hackathons', slug, 'leaderboard'],
      queryFn: () => apiRequest<ApiResponse<LeaderboardEntry[]>>(`/api/v1/hackathons/${slug}/judging/leaderboard`),
      enabled: !!slug,
    }),
};

export const judgeQueries = {
  assignments: (slug: string) =>
    queryOptions({
      queryKey: ['judge', slug, 'assignments'],
      queryFn: () => apiRequest<ApiResponse<JudgeAssignment[]>>(`/api/v1/hackathons/${slug}/judging/my-assignments`),
      enabled: !!slug,
    }),
};

export const notificationQueries = {
  unreadCount: () =>
    queryOptions({
      queryKey: ['notifications', 'unread-count'],
      queryFn: () => apiRequest<ApiResponse<{ count: number }>>('/api/v1/notifications/unread-count'),
    }),
};

// Re-export types for use in components
export type {
  Hackathon,
  RubricCriterion,
  LeaderboardEntry,
  JudgeAssignment,
  Notification,
  ApiResponse,
};
