/* ─────────────────────────────────────────────────────────────
   SubmissionStatusCard — Primary submission state display
   
   Shows the latest/final submission with full lifecycle status,
   commit info, tag name, validation state, and contextual
   actions (finalize, view on GitHub).
   ───────────────────────────────────────────────────────────── */
import {
  Tag,
  GitCommit,
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
  Eye,
  Award,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Hackathon, Submission, DashboardPhase } from '../types';
import {
  getLatestSubmission,
  getFinalSubmission,
  getSubmissionStatusColor,
  getSubmissionStatusLabel,
  shortSha,
  formatShortDate,
  formatRelativeTime,
} from '../utils';

/* ── Status Icon Map ─────────────────────────────────────────── */
const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  received: Clock,
  validated: CheckCircle2,
  locked: Lock,
  under_review: Eye,
  scored: Award,
  invalid: XCircle,
  invalidated: XCircle,
};

/* ── Props ────────────────────────────────────────────────────── */
interface SubmissionStatusCardProps {
  hackathon: Hackathon;
  submissions: Submission[];
  isLoading: boolean;
  phase: DashboardPhase;
}

export function SubmissionStatusCard({
  hackathon,
  submissions,
  isLoading,
  phase,
}: SubmissionStatusCardProps) {
  const latest = getLatestSubmission(submissions);
  const finalSub = getFinalSubmission(submissions);
  const displaySub = finalSub ?? latest;

  /* ── Loading state ──────────────────────────────────────────── */
  if (isLoading) {
    return (
      <Card className="border-white/8 bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#CCFF00]" />
            Submission Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-white/40 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading submission data…
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ── Empty state — no submissions yet ───────────────────────── */
  if (!displaySub) {
    const isDeadlinePassed = phase === 'submission_locked';

    return (
      <Card className="border-white/8 bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#CCFF00]" />
            Submission Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isDeadlinePassed ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-300">
                    Deadline passed — no submission received
                  </p>
                  <p className="text-xs text-red-300/60 mt-1">
                    The submission window has closed and no tags were detected
                    from your repository.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
              <Tag className="h-8 w-8 text-white/15 mx-auto mb-3" />
              <p className="text-sm font-medium text-white/50">
                No submissions yet
              </p>
              <p className="text-xs text-white/30 mt-1.5 max-w-sm mx-auto">
                Push a git tag matching{' '}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-[#CCFF00] font-mono text-[11px]">
                  {hackathon.submission_tag_pattern.replace('%', '*')}
                </code>{' '}
                to your connected repository to submit.
              </p>
              <div className="mt-4 rounded-lg bg-white/[0.03] border border-white/8 p-3">
                <p className="text-[11px] text-white/30 font-mono text-left">
                  <span className="text-white/50">$</span> git tag submission_v1
                  <br />
                  <span className="text-white/50">$</span> git push origin
                  submission_v1
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  /* ── Active submission display ──────────────────────────────── */
  const StatusIcon = STATUS_ICON[displaySub.status] ?? Clock;
  const statusColor = getSubmissionStatusColor(displaySub.status);
  const statusLabel = getSubmissionStatusLabel(displaySub.status);
  const isErrorState =
    displaySub.status === 'invalid' || displaySub.status === 'invalidated';
  const isLocked = displaySub.status === 'locked';
  const isScored = displaySub.status === 'scored';

  return (
    <Card className="border-white/8 bg-white/[0.02]">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#CCFF00]" />
            Submission Status
            {submissions.length > 0 && (
              <span className="text-xs font-normal text-white/30 ml-1">
                ({submissions.length} total)
              </span>
            )}
          </CardTitle>

          {displaySub.is_final && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              <Lock className="h-3 w-3" />
              Final
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status banner */}
        <div
          className="flex items-center justify-between rounded-xl p-4"
          style={{
            backgroundColor: `${statusColor}10`,
            border: `1px solid ${statusColor}25`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: `${statusColor}20` }}
            >
              <StatusIcon
                className="h-5 w-5"
                style={{ color: statusColor }}
              />
            </div>
            <div>
              <p
                className="text-sm font-bold"
                style={{ color: statusColor }}
              >
                {statusLabel}
              </p>
              <p className="text-xs text-white/40">
                Version {displaySub.version} •{' '}
                {formatRelativeTime(new Date(displaySub.submitted_at))}
              </p>
            </div>
          </div>

          {displaySub.is_late && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Late
            </span>
          )}
        </div>

        {/* Validation errors */}
        {isErrorState && displaySub.validation_errors && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-xs font-medium text-red-300 mb-1">
              Validation Errors
            </p>
            <p className="text-xs text-red-300/70 font-mono whitespace-pre-wrap">
              {displaySub.validation_errors}
            </p>
          </div>
        )}

        {/* Commit details */}
        <div className="grid grid-cols-2 gap-3">
          {/* Tag */}
          <div className="rounded-lg bg-white/[0.03] border border-white/6 p-3">
            <p className="text-[11px] text-white/30 uppercase tracking-wider mb-1">
              Tag
            </p>
            <p className="text-sm font-mono text-[#CCFF00] font-medium truncate">
              {displaySub.tag_name}
            </p>
          </div>

          {/* Commit SHA */}
          <div className="rounded-lg bg-white/[0.03] border border-white/6 p-3">
            <p className="text-[11px] text-white/30 uppercase tracking-wider mb-1">
              Commit
            </p>
            <p className="text-sm font-mono text-white/70 font-medium">
              <GitCommit className="inline h-3.5 w-3.5 mr-1 text-white/30" />
              {shortSha(displaySub.commit_sha)}
            </p>
          </div>

          {/* Commit message */}
          {displaySub.commit_message && (
            <div className="col-span-2 rounded-lg bg-white/[0.03] border border-white/6 p-3">
              <p className="text-[11px] text-white/30 uppercase tracking-wider mb-1">
                Message
              </p>
              <p className="text-sm text-white/60 line-clamp-2">
                {displaySub.commit_message}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="rounded-lg bg-white/[0.03] border border-white/6 p-3">
            <p className="text-[11px] text-white/30 uppercase tracking-wider mb-1">
              Submitted
            </p>
            <p className="text-xs text-white/50">
              {formatShortDate(displaySub.submitted_at)}
            </p>
          </div>

          <div className="rounded-lg bg-white/[0.03] border border-white/6 p-3">
            <p className="text-[11px] text-white/30 uppercase tracking-wider mb-1">
              {displaySub.commit_author ? 'Author' : 'Branch'}
            </p>
            <p className="text-xs text-white/50 truncate">
              {displaySub.commit_author ?? displaySub.branch ?? 'main'}
            </p>
          </div>
        </div>

        {/* Scored state — show score placeholder */}
        {isScored && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
            <Award className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-emerald-300">
              Submission scored by judges
            </p>
            <p className="text-xs text-emerald-300/50 mt-1">
              Final results will appear on the leaderboard.
            </p>
          </div>
        )}

        {/* Locked state info */}
        {isLocked && displaySub.locked_at && (
          <div className="flex items-center gap-2 text-xs text-blue-300/60">
            <Lock className="h-3 w-3" />
            Locked on {formatShortDate(displaySub.locked_at)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
