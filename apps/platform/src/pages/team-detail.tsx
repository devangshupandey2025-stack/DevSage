import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hackathonQueries } from '@/lib/queries';
import { PageHeader } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, GitBranch, Crown, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TeamDetailPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const { data: teamRes, isPending: teamLoading } = useQuery(hackathonQueries.teamDetail(slug!, id!));
  const { data: subsRes, isPending: subsLoading } = useQuery(hackathonQueries.submissions(slug!));

  const team = teamRes?.data;
  const submissions = subsRes?.data?.filter((s) => s.team_id === id) ?? [];

  if (teamLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/60">
        <p className="text-lg">Team not found</p>
        <Link to={`/hackathons/${slug}/teams`} className="mt-4 text-[#CCFF00] hover:underline">
          Back to teams
        </Link>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    forming: 'bg-amber-500/20 text-amber-400',
    ready: 'bg-emerald-500/20 text-emerald-400',
    submitted: 'bg-sky-500/20 text-sky-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/hackathons/${slug}/teams`}>
          <Button variant="ghost" size="icon" className="text-white/60 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <PageHeader
          title={team.name}
          badge={
            <Badge className={statusColor[team.status] ?? 'bg-white/10 text-white/60'}>
              {team.status}
            </Badge>
          }
        />
      </div>

      {/* Members */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Users className="h-5 w-5 text-[#CCFF00]" />
            Members ({team.members?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {team.members && team.members.length > 0 ? (
            <div className="space-y-3">
              {team.members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-3">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="h-9 w-9 rounded-full" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#CCFF00] text-sm font-bold text-black">
                      {member.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{member.display_name}</p>
                    <p className="text-xs text-white/40">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                  </div>
                  {member.role === 'team_lead' && (
                    <Crown className="h-4 w-4 text-[#CCFF00]" />
                  )}
                  <Badge variant="outline" className="border-white/10 text-xs text-white/60">
                    {member.role.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/40">No members yet</p>
          )}
        </CardContent>
      </Card>

      {/* Submissions */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <GitBranch className="h-5 w-5 text-[#CCFF00]" />
            Submissions ({submissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : submissions.length > 0 ? (
            <div className="space-y-3">
              {submissions.map((sub) => {
                const subStatusColor: Record<string, string> = {
                  validated: 'text-emerald-400',
                  failed_validation: 'text-red-400',
                  pending_validation: 'text-sky-400',
                };
                return (
                  <div key={sub.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center gap-3">
                      <GitBranch className={`h-4 w-4 ${subStatusColor[sub.status] ?? 'text-white/40'}`} />
                      <div>
                        <p className="text-sm font-medium text-white">{sub.tag_name}</p>
                        <p className="font-mono text-xs text-white/40">{sub.commit_sha.slice(0, 7)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={`border-white/10 text-xs ${subStatusColor[sub.status] ?? 'text-white/40'}`}>
                        {sub.status.replace('_', ' ')}
                      </Badge>
                      <p className="mt-1 text-xs text-white/30">
                        {new Date(sub.submitted_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/40">No submissions yet</p>
          )}
        </CardContent>
      </Card>

      {/* Invite Code */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <p className="text-sm font-medium text-white">Invite Code</p>
            <p className="text-xs text-white/40">Share this code to invite members</p>
          </div>
          <code className="rounded-lg border border-[#CCFF00]/20 bg-[#CCFF00]/5 px-4 py-2 font-mono text-lg text-[#CCFF00]">
            {team.invite_code}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
