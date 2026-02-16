/* ─────────────────────────────────────────────────────────────
   Participant Dashboard — Pure Utility Functions
   ───────────────────────────────────────────────────────────── */
import type {
  Hackathon,
  Team,
  Submission,
  ChecklistItem,
  DashboardPhase,
  DeadlineInfo,
  TeamMember,
} from './types';

/* ── Phase Resolution ───────────────────────────────────────── */

export function resolveDashboardPhase(
  hackathon: Hackathon,
  team: Team | null | undefined,
  _userId: string
): DashboardPhase {
  const now = new Date();
  const status = hackathon.status;

  if (status === 'completed' || status === 'archived') return 'completed';
  if (status === 'judging') return 'judging';

  if (status === 'active') {
    if (!team) return 'no_team';
    const deadline = new Date(hackathon.submission_deadline);
    if (now > deadline) return 'submission_locked';
    return 'hacking';
  }

  // draft
  if (!team) return 'no_team';
  return 'pre_hacking';
}

/* ── Team Helpers ───────────────────────────────────────────── */

export function findUserTeam(teams: Team[], userId: string): Team | null {
  return (
    teams.find(
      (t) => t.members?.some((m) => m.user_id === userId)
    ) ?? null
  );
}

export function isTeamLeader(team: Team, userId: string): boolean {
  return team.members?.some(
    (m) => m.user_id === userId && m.role === 'leader'
  ) ?? false;
}

export function getTeamLeader(team: Team): TeamMember | undefined {
  return team.members?.find((m) => m.role === 'leader');
}

/* ── Deadline Helpers ───────────────────────────────────────── */

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff < 0;

  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(absDiff / 3_600_000);
  const days = Math.floor(absDiff / 86_400_000);

  let relative: string;
  if (days > 0) {
    relative = `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    relative = `${hours}h ${minutes % 60}m`;
  } else {
    relative = `${minutes}m`;
  }

  return isPast ? `${relative} ago` : `in ${relative}`;
}

export function getDeadlineInfo(
  label: string,
  isoDate: string
): DeadlineInfo {
  const date = new Date(isoDate);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  return {
    label,
    date,
    isPast: diff < 0,
    isImminent: diff > 0 && diff < 7_200_000, // 2 hours
    relative: formatRelativeTime(date),
  };
}

/* ── Submission Helpers ─────────────────────────────────────── */

export function getLatestSubmission(
  submissions: Submission[]
): Submission | null {
  if (submissions.length === 0) return null;
  return submissions.reduce((latest, sub) =>
    new Date(sub.submitted_at) > new Date(latest.submitted_at) ? sub : latest
  );
}

export function getFinalSubmission(
  submissions: Submission[]
): Submission | null {
  return submissions.find((s) => s.is_final) ?? null;
}

export function getSubmissionStatusColor(status: string): string {
  const colors: Record<string, string> = {
    received: '#CCFF00',
    validated: '#22C55E',
    locked: '#3B82F6',
    under_review: '#A855F7',
    scored: '#10B981',
    invalid: '#EF4444',
    invalidated: '#EF4444',
  };
  return colors[status] ?? '#6B7280';
}

export function getSubmissionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    received: 'Received',
    validated: 'Validated',
    locked: 'Locked',
    under_review: 'Under Review',
    scored: 'Scored',
    invalid: 'Invalid',
    invalidated: 'Invalidated',
  };
  return labels[status] ?? status;
}

/* ── Checklist Builder ──────────────────────────────────────── */

export function buildChecklist(
  hackathon: Hackathon,
  team: Team | null,
  submissions: Submission[],
  userId: string
): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // 1. Join a team
  items.push({
    id: 'join-team',
    label: 'Join or create a team',
    description: 'You need a team to participate in the hackathon.',
    completed: !!team,
    href: `/hackathons/${hackathon.slug}`,
    action: 'Join Team',
  });

  // 2. Connect GitHub repo
  items.push({
    id: 'connect-repo',
    label: 'Connect a GitHub repository',
    description: 'Link your team\'s repo so submissions are tracked via webhooks.',
    completed: !!team?.repo_full_name,
    href: team ? `/hackathons/${hackathon.slug}/teams` : undefined,
    action: 'Connect Repo',
  });

  // 3. Make first submission
  const hasSubmission = submissions.length > 0;
  items.push({
    id: 'first-submission',
    label: 'Push your first submission tag',
    description: `Push a git tag matching "${hackathon.submission_tag_pattern}" to submit.`,
    completed: hasSubmission,
  });

  // 4. Validated submission
  const hasValidated = submissions.some(
    (s) => s.status === 'validated' || s.status === 'locked' || s.status === 'scored'
  );
  items.push({
    id: 'validated-submission',
    label: 'Get a submission validated',
    description: 'At least one submission must pass validation.',
    completed: hasValidated,
  });

  return items;
}

/* ── Date Formatting ────────────────────────────────────────── */

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ── Commit SHA Formatting ──────────────────────────────────── */

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
