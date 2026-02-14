/* ─────────────────────────────────────────────────────────────
   SubmissionHistory — Table of all past submissions
   
   Shows version history with status, tag, commit, and timing.
   Used when there are multiple submissions to track.
   ───────────────────────────────────────────────────────────── */
import {
  Tag,
  GitCommit,
  AlertTriangle,
  Lock,
  History,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Hackathon, Submission } from '../types';
import {
  getSubmissionStatusColor,
  getSubmissionStatusLabel,
  shortSha,
  formatShortDate,
} from '../utils';

interface SubmissionHistoryProps {
  submissions: Submission[];
  hackathon: Hackathon;
}

export function SubmissionHistory({
  submissions,
  hackathon,
}: SubmissionHistoryProps) {
  // Sort by version descending (newest first)
  const sorted = [...submissions].sort((a, b) => b.version - a.version);

  return (
    <Card className="border-white/8 bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-[#CCFF00]" />
          Submission History
          <span className="text-xs font-normal text-white/30">
            ({submissions.length})
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {sorted.map((sub) => {
            const statusColor = getSubmissionStatusColor(sub.status);
            const statusLabel = getSubmissionStatusLabel(sub.status);

            return (
              <div
                key={sub.id}
                className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/6 px-3 py-2.5 group hover:bg-white/[0.04] transition-colors"
              >
                {/* Version badge */}
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-xs font-bold text-white/50 shrink-0">
                  v{sub.version}
                </div>

                {/* Tag + commit */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-white/70 truncate">
                      {sub.tag_name}
                    </span>
                    {sub.is_final && (
                      <Lock className="h-3 w-3 text-blue-400 shrink-0" />
                    )}
                    {sub.is_late && (
                      <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-white/25 font-mono flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      {shortSha(sub.commit_sha)}
                    </span>
                    <span className="text-[11px] text-white/20">•</span>
                    <span className="text-[11px] text-white/20">
                      {formatShortDate(sub.submitted_at)}
                    </span>
                  </div>
                </div>

                {/* Status pill */}
                <span
                  className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${statusColor}15`,
                    color: statusColor,
                  }}
                >
                  {statusLabel}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
