/* ─────────────────────────────────────────────────────────────
   Participant Dashboard — Main Page
   Route: /hackathons/:slug/participant
   
   Primary control center for hackathon participants.
   Renders phase-aware layout with team, submission, activity,
   and progress tracking panels.
   ───────────────────────────────────────────────────────────── */
import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import {
  useHackathon,
  useTeams,
  useTeamDetail,
  useSubmissions,
  useRubric,
} from './hooks';
import {
  resolveDashboardPhase,
  findUserTeam,
  isTeamLeader,
  buildChecklist,
  getDeadlineInfo,
} from './utils';
import { PhaseHeader } from './components/PhaseHeader';
import { DeadlineBar } from './components/DeadlineBar';
import { ChecklistPanel } from './components/ChecklistPanel';
import { TeamRepoCard } from './components/TeamRepoCard';
import { SubmissionStatusCard } from './components/SubmissionStatusCard';
import { SubmissionHistory } from './components/SubmissionHistory';
import { ActivityFeed } from './components/ActivityFeed';
import { NoTeamCTA } from './components/NoTeamCTA';
import { DashboardSkeleton } from './components/DashboardSkeleton';

export function ParticipantDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  /* ── Data fetching ─────────────────────────────────────────── */
  const hackathonQuery = useHackathon(slug!);
  const teamsQuery = useTeams(slug!);

  // Resolve which team the current user belongs to
  const myTeam = useMemo(() => {
    if (!teamsQuery.data || !user) return null;
    return findUserTeam(teamsQuery.data, user.id);
  }, [teamsQuery.data, user]);

  // Fetch full team detail once we know the team ID
  const teamDetailQuery = useTeamDetail(slug!, myTeam?.id);
  const team = teamDetailQuery.data ?? myTeam;

  // Submissions for the user's team
  const submissionsQuery = useSubmissions(slug!, myTeam?.id);
  const submissions = submissionsQuery.data ?? [];

  // Rubric (available after hackathon is active)
  const rubricQuery = useRubric(slug!);

  /* ── Derived state ─────────────────────────────────────────── */
  const hackathon = hackathonQuery.data;

  const phase = useMemo(() => {
    if (!hackathon || !user) return null;
    return resolveDashboardPhase(hackathon, team, user.id);
  }, [hackathon, team, user]);

  const leader = useMemo(() => {
    if (!team || !user) return false;
    return isTeamLeader(team, user.id);
  }, [team, user]);

  const checklist = useMemo(() => {
    if (!hackathon || !user) return [];
    return buildChecklist(hackathon, team ?? null, submissions, user.id);
  }, [hackathon, team, submissions, user]);

  const deadlines = useMemo(() => {
    if (!hackathon) return [];
    return [
      getDeadlineInfo('Registration Closes', hackathon.registration_closes),
      getDeadlineInfo('Submission Deadline', hackathon.submission_deadline),
      ...(hackathon.judging_starts
        ? [getDeadlineInfo('Judging Starts', hackathon.judging_starts)]
        : []),
    ];
  }, [hackathon]);

  /* ── Loading / Error states ────────────────────────────────── */
  const isLoading =
    hackathonQuery.isLoading || teamsQuery.isLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (hackathonQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">
          Failed to load hackathon
        </h2>
        <p className="text-white/50 text-sm mb-6">
          {hackathonQuery.error instanceof Error
            ? hackathonQuery.error.message
            : 'Something went wrong.'}
        </p>
        <Link
          to="/dashboard"
          className="text-[#CCFF00] text-sm font-medium hover:underline"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!hackathon) return null;

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          to={`/hackathons/${slug}`}
          className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {hackathon.title}
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-white/70 text-sm font-medium">
          Participant Dashboard
        </span>
      </div>

      {/* Phase-aware header */}
      <PhaseHeader
        hackathon={hackathon}
        phase={phase!}
        team={team ?? null}
        userName={user?.display_name?.split(' ')[0] ?? 'there'}
      />

      {/* Deadline countdown bar */}
      <DeadlineBar deadlines={deadlines} hackathonStatus={hackathon.status} />

      {/* No team state */}
      {(phase === 'no_team' || phase === 'registration') && !team && (
        <NoTeamCTA hackathon={hackathon} />
      )}

      {/* Main dashboard grid — only when user has a team */}
      {team && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column — 2/3 width */}
          <div className="space-y-6 lg:col-span-2">
            {/* Team & Repo */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <TeamRepoCard
                hackathon={hackathon}
                team={team}
                isLeader={leader}
                slug={slug!}
              />
            </motion.div>

            {/* Latest Submission Status */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <SubmissionStatusCard
                hackathon={hackathon}
                submissions={submissions}
                isLoading={submissionsQuery.isLoading}
                phase={phase!}
              />
            </motion.div>

            {/* Submission History */}
            {submissions.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <SubmissionHistory
                  submissions={submissions}
                  hackathon={hackathon}
                />
              </motion.div>
            )}
          </div>

          {/* Right column — 1/3 width */}
          <div className="space-y-6">
            {/* Progress Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <ChecklistPanel items={checklist} />
            </motion.div>

            {/* Activity Feed */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <ActivityFeed
                submissions={submissions}
                team={team}
                hackathon={hackathon}
              />
            </motion.div>
          </div>
        </div>
      )}

      {/* Loading indicator for background refetches */}
      {(submissionsQuery.isFetching || teamDetailQuery.isFetching) &&
        !isLoading && (
          <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-2 text-xs text-white/50">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing…
          </div>
        )}
    </div>
  );
}
