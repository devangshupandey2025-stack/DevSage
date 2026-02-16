import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hackathonQueries } from '@/lib/queries';
import { PageHeader } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award } from 'lucide-react';

export function LeaderboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: leaderboardRes, isPending } = useQuery(hackathonQueries.leaderboard(slug!));
  const { data: hackathonRes } = useQuery(hackathonQueries.detail(slug!));

  const entries = leaderboardRes?.data ?? [];
  const hackathon = hackathonRes?.data;
  const isPublished = hackathon?.status === 'completed' || hackathon?.status === 'archived';

  const rankIcons = [
    <Trophy key="1" className="h-6 w-6 text-yellow-400" />,
    <Medal key="2" className="h-6 w-6 text-gray-300" />,
    <Award key="3" className="h-6 w-6 text-amber-600" />,
  ];

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboard"
        description={isPublished ? 'Final results' : 'Live scoring — results not yet published'}
        badge={
          <Badge className={isPublished ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>
            {isPublished ? 'Published' : 'In Progress'}
          </Badge>
        }
      />

      {entries.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-white/20" />
            <p className="mt-4 text-white/40">No scores submitted yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card
              key={entry.team_id}
              className={`border-white/10 bg-white/5 transition hover:border-[#CCFF00]/20 ${
                entry.rank <= 3 ? 'border-[#CCFF00]/10' : ''
              }`}
            >
              <CardContent className="flex items-center gap-4 py-4">
                {/* Rank */}
                <div className="flex w-12 items-center justify-center">
                  {entry.rank <= 3 ? (
                    rankIcons[entry.rank - 1]
                  ) : (
                    <span className="text-lg font-bold text-white/40">#{entry.rank}</span>
                  )}
                </div>

                {/* Team info */}
                <div className="flex-1">
                  <p className="font-semibold text-white">{entry.team_name}</p>
                  <p className="text-xs text-white/40">
                    Scored by {entry.judges_scored} judge{entry.judges_scored !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Criteria breakdown */}
                {entry.criteria_scores && (
                  <div className="hidden gap-3 md:flex">
                    {entry.criteria_scores.map((cs) => (
                      <div key={cs.name} className="text-center">
                        <p className="text-xs text-white/40">{cs.name}</p>
                        <p className="text-sm font-medium text-white">{cs.average.toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Total score */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#CCFF00]">{entry.total_score.toFixed(1)}</p>
                  <p className="text-xs text-white/40">total</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
