/* ─────────────────────────────────────────────────────────────
   TeamRepoCard — Team info + repo connection status
   
   Shows team name, member roster, invite code, connected repo
   status, and repo connection CTA for team leaders.
   ───────────────────────────────────────────────────────────── */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Users,
  GitBranch,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Crown,
  Bot,
  Unplug,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Hackathon, Team } from '../types';
import { getTeamLeader } from '../utils';

interface TeamRepoCardProps {
  hackathon: Hackathon;
  team: Team;
  isLeader: boolean;
  slug: string;
}

export function TeamRepoCard({
  hackathon,
  team,
  isLeader,
  slug,
}: TeamRepoCardProps) {
  const [copied, setCopied] = useState(false);
  const leader = getTeamLeader(team);

  const hasRepo = !!team.repo_full_name;
  const repoGitHubUrl = team.repo_url
    ?? (team.repo_full_name
      ? `https://github.com/${team.repo_full_name}`
      : null);

  function handleCopyInvite() {
    if (!team.invite_code) return;
    navigator.clipboard.writeText(team.invite_code);
    setCopied(true);
    toast.success('Invite code copied');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-white/8 bg-white/2">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-[#CCFF00]" />
            {team.name}
          </CardTitle>
          <Link
            to={`/hackathons/${slug}/teams`}
            className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors"
          >
            Manage Team
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Members ──────────────────────────────────────────── */}
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2.5">
            Members ({team.members?.length ?? 0}/{hackathon.max_team_size})
          </p>
          <div className="space-y-2">
            {team.members?.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center gap-3 rounded-lg bg-white/3 border border-white/6 px-3 py-2.5"
              >
                {/* Avatar */}
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.display_name}
                    className="h-7 w-7 rounded-full ring-1 ring-white/10"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold text-white/50">
                    {member.display_name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 font-medium truncate">
                    {member.display_name}
                  </p>
                  {member.github_username && (
                    <p className="text-[11px] text-white/30 truncate">
                      @{member.github_username}
                    </p>
                  )}
                </div>

                {member.role === 'leader' && (
                  <Crown className="h-3.5 w-3.5 text-[#CCFF00] shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Invite Code ─────────────────────────────────────── */}
        {team.invite_code && (
          <div>
            <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">
              Invite Code
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-white/4 border border-white/8 px-3 py-2 font-mono text-sm text-[#CCFF00] tracking-widest">
                {team.invite_code}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyInvite}
                className="shrink-0 border-white/10 bg-white/5 hover:bg-white/10 text-white/60"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-white/25 mt-1.5">
              Share this code with teammates to join your team.
            </p>
          </div>
        )}

        {/* ── Repository Connection ───────────────────────────── */}
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2.5">
            Repository
          </p>

          {hasRepo ? (
            <div className="rounded-xl border border-white/8 bg-white/3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/6">
                    <GitBranch className="h-4 w-4 text-[#CCFF00]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">
                      {team.repo_full_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {team.bot_active ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                          <Bot className="h-3 w-3" />
                          Webhook active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-amber-400">
                          <Unplug className="h-3 w-3" />
                          Webhook inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {repoGitHubUrl && (
                  <a
                    href={repoGitHubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>

              {/* Webhook warning if not active */}
              {!team.bot_active && (
                <div className="mt-3 rounded-lg border border-amber-500/15 bg-amber-500/5 p-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-300/70">
                      The DevSage GitHub App isn't installed on this repo.
                      Submissions won't be detected automatically. Ask the repo
                      owner to install the app.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* No repo connected */
            <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
              <GitBranch className="h-7 w-7 text-white/15 mx-auto mb-2.5" />
              <p className="text-sm font-medium text-white/50">
                No repository connected
              </p>
              <p className="text-[11px] text-white/30 mt-1 mb-3">
                {isLeader
                  ? 'Connect a GitHub repository to enable tag-based submissions.'
                  : 'Ask your team leader to connect a repository.'}
              </p>
              {isLeader && (
                <Link to={`/hackathons/${slug}/teams`}>
                  <Button
                    size="sm"
                    className="bg-[#CCFF00] text-black hover:bg-[#CCFF00]/80 font-semibold text-xs"
                  >
                    <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                    Connect Repository
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
