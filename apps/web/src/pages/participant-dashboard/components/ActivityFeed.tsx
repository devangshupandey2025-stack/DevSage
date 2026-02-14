/* ─────────────────────────────────────────────────────────────
   ActivityFeed — Real-time activity stream for participants
   
   Derives activity from submission events and team state.
   Shows a chronological feed of tag pushes, validations,
   team member joins, repo connections, and status changes.
   ───────────────────────────────────────────────────────────── */
import { useMemo } from 'react';
import {
  Tag,
  CheckCircle2,
  XCircle,
  Lock,
  GitBranch,
  UserPlus,
  Clock,
  Award,
  Eye,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Hackathon, Submission, Team } from '../types';
import { shortSha, formatRelativeTime } from '../utils';

/* ── Derived Activity Item ───────────────────────────────────── */
interface FeedItem {
  id: string;
  icon: typeof Tag;
  iconColor: string;
  title: string;
  detail: string;
  timestamp: Date;
  relative: string;
}

/* ── Props ────────────────────────────────────────────────────── */
interface ActivityFeedProps {
  submissions: Submission[];
  team: Team;
  hackathon: Hackathon;
}

/* ── Submission → FeedItem mapping ───────────────────────────── */
function submissionToFeedItems(sub: Submission): FeedItem[] {
  const items: FeedItem[] = [];
  const ts = new Date(sub.submitted_at);

  // Tag received event
  items.push({
    id: `${sub.id}-received`,
    icon: Tag,
    iconColor: '#CCFF00',
    title: `Tag ${sub.tag_name} pushed`,
    detail: `Commit ${shortSha(sub.commit_sha)}${sub.commit_author ? ` by ${sub.commit_author}` : ''} • v${sub.version}`,
    timestamp: ts,
    relative: formatRelativeTime(ts),
  });

  // Status-based events
  if (sub.status === 'validated') {
    items.push({
      id: `${sub.id}-validated`,
      icon: CheckCircle2,
      iconColor: '#22C55E',
      title: `${sub.tag_name} validated`,
      detail: 'Submission passed all validation checks.',
      timestamp: ts,
      relative: formatRelativeTime(ts),
    });
  }

  if (sub.status === 'invalid' || sub.status === 'invalidated') {
    items.push({
      id: `${sub.id}-invalid`,
      icon: XCircle,
      iconColor: '#EF4444',
      title: `${sub.tag_name} failed validation`,
      detail: sub.validation_errors ?? 'Submission did not pass validation.',
      timestamp: ts,
      relative: formatRelativeTime(ts),
    });
  }

  if (sub.status === 'locked' && sub.locked_at) {
    const lockedAt = new Date(sub.locked_at);
    items.push({
      id: `${sub.id}-locked`,
      icon: Lock,
      iconColor: '#3B82F6',
      title: `${sub.tag_name} locked for judging`,
      detail: 'This submission has been finalized.',
      timestamp: lockedAt,
      relative: formatRelativeTime(lockedAt),
    });
  }

  if (sub.status === 'under_review') {
    items.push({
      id: `${sub.id}-review`,
      icon: Eye,
      iconColor: '#A855F7',
      title: `${sub.tag_name} under review`,
      detail: 'Judges are currently reviewing this submission.',
      timestamp: ts,
      relative: formatRelativeTime(ts),
    });
  }

  if (sub.status === 'scored') {
    items.push({
      id: `${sub.id}-scored`,
      icon: Award,
      iconColor: '#10B981',
      title: `${sub.tag_name} scored`,
      detail: 'Scoring complete. Check the leaderboard for results.',
      timestamp: ts,
      relative: formatRelativeTime(ts),
    });
  }

  return items;
}

/* ── Team → FeedItem mapping ─────────────────────────────────── */
function teamToFeedItems(team: Team): FeedItem[] {
  const items: FeedItem[] = [];

  // Team creation
  const createdAt = new Date(team.created_at);
  items.push({
    id: `team-created`,
    icon: UserPlus,
    iconColor: '#CCFF00',
    title: `Team "${team.name}" created`,
    detail: 'Your team was formed for this hackathon.',
    timestamp: createdAt,
    relative: formatRelativeTime(createdAt),
  });

  // Repo connection
  if (team.repo_full_name) {
    items.push({
      id: `repo-connected`,
      icon: GitBranch,
      iconColor: '#00D4FF',
      title: `Repository connected`,
      detail: team.repo_full_name,
      timestamp: createdAt, // approximate — no exact timestamp for repo connect
      relative: formatRelativeTime(createdAt),
    });
  }

  // Member joins
  team.members?.forEach((member) => {
    const joinedAt = new Date(member.joined_at);
    items.push({
      id: `member-${member.user_id}`,
      icon: UserPlus,
      iconColor: '#818CF8',
      title: `${member.display_name} joined`,
      detail: member.role === 'leader' ? 'Team leader' : 'Team member',
      timestamp: joinedAt,
      relative: formatRelativeTime(joinedAt),
    });
  });

  return items;
}

/* ── Component ───────────────────────────────────────────────── */
export function ActivityFeed({
  submissions,
  team,
  hackathon,
}: ActivityFeedProps) {
  const feed = useMemo(() => {
    const items: FeedItem[] = [];

    // Submission events
    submissions.forEach((sub) => {
      items.push(...submissionToFeedItems(sub));
    });

    // Team events
    items.push(...teamToFeedItems(team));

    // Sort newest first, deduplicate by id
    const seen = new Set<string>();
    return items
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 15); // cap at 15 items
  }, [submissions, team]);

  return (
    <Card className="border-white/8 bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#CCFF00]" />
          Activity
        </CardTitle>
      </CardHeader>

      <CardContent>
        {feed.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/8 p-6 text-center">
            <Clock className="h-6 w-6 text-white/15 mx-auto mb-2" />
            <p className="text-xs text-white/30">No activity yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/6" />

            <div className="space-y-4">
              {feed.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex gap-3 relative">
                    {/* Icon dot */}
                    <div
                      className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-black"
                    >
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{ color: item.iconColor }}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm text-white/70 font-medium truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-white/30 truncate mt-0.5">
                        {item.detail}
                      </p>
                      <p className="text-[10px] text-white/20 mt-1">
                        {item.relative}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
