/* ─────────────────────────────────────────────────────────────
   Participant Dashboard — Data Hooks (TanStack Query)
   ───────────────────────────────────────────────────────────── */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type {
  Hackathon,
  Team,
  Submission,
  ActivityEvent,
  RubricCriterion,
  LeaderboardEntry,
  ApiEnvelope,
} from './types';

/* ── Query Key Factory ──────────────────────────────────────── */
export const dashboardKeys = {
  all: ['participant-dashboard'] as const,
  hackathon: (slug: string) => [...dashboardKeys.all, 'hackathon', slug] as const,
  myTeam: (slug: string) => [...dashboardKeys.all, 'my-team', slug] as const,
  teams: (slug: string) => [...dashboardKeys.all, 'teams', slug] as const,
  submissions: (slug: string, teamId?: string) =>
    [...dashboardKeys.all, 'submissions', slug, teamId] as const,
  activity: (slug: string) => [...dashboardKeys.all, 'activity', slug] as const,
  rubric: (slug: string) => [...dashboardKeys.all, 'rubric', slug] as const,
  leaderboard: (slug: string) => [...dashboardKeys.all, 'leaderboard', slug] as const,
};

/* ── Hackathon Detail ───────────────────────────────────────── */
export function useHackathon(slug: string) {
  return useQuery({
    queryKey: dashboardKeys.hackathon(slug),
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<Hackathon>>(
        `/api/v1/hackathons/${slug}`
      );
      return res.data;
    },
    staleTime: 60_000,
  });
}

/* ── Teams List (to find current user's team) ───────────────── */
export function useTeams(slug: string) {
  return useQuery({
    queryKey: dashboardKeys.teams(slug),
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<Team[]>>(
        `/api/v1/hackathons/${slug}/teams?limit=100`
      );
      return res.data;
    },
    staleTime: 30_000,
  });
}

/* ── Single Team Detail ─────────────────────────────────────── */
export function useTeamDetail(slug: string, teamId: string | undefined) {
  return useQuery({
    queryKey: dashboardKeys.myTeam(slug),
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<Team>>(
        `/api/v1/hackathons/${slug}/teams/${teamId}`
      );
      return res.data;
    },
    enabled: !!teamId,
    staleTime: 15_000,
  });
}

/* ── Submissions ────────────────────────────────────────────── */
export function useSubmissions(slug: string, teamId: string | undefined) {
  return useQuery({
    queryKey: dashboardKeys.submissions(slug, teamId),
    queryFn: async () => {
      const endpoint = teamId
        ? `/api/v1/hackathons/${slug}/submissions/${teamId}`
        : `/api/v1/hackathons/${slug}/submissions`;
      const res = await apiRequest<ApiEnvelope<Submission[]>>(endpoint);
      return res.data;
    },
    enabled: !!teamId,
    staleTime: 10_000,
    refetchInterval: 30_000, // poll for new webhook-driven submissions
  });
}

/* ── Activity Feed ──────────────────────────────────────────── */
export function useActivity(slug: string, teamId: string | undefined) {
  return useQuery({
    queryKey: dashboardKeys.activity(slug),
    queryFn: async () => {
      // Activity comes from audit events scoped to the hackathon
      const res = await apiRequest<ApiEnvelope<ActivityEvent[]>>(
        `/api/v1/hackathons/${slug}/submissions/${teamId}`
      );
      // Derive activity from submissions + team events
      return res.data;
    },
    enabled: !!teamId,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

/* ── Rubric ──────────────────────────────────────────────────── */
export function useRubric(slug: string) {
  return useQuery({
    queryKey: dashboardKeys.rubric(slug),
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<RubricCriterion[]>>(
        `/api/v1/hackathons/${slug}/rubric`
      );
      return res.data;
    },
    staleTime: 300_000, // rubric rarely changes
  });
}

/* ── Leaderboard ─────────────────────────────────────────────── */
export function useLeaderboard(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.leaderboard(slug),
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<LeaderboardEntry[]>>(
        `/api/v1/hackathons/${slug}/leaderboard`
      );
      return res.data;
    },
    enabled,
    staleTime: 60_000,
  });
}
