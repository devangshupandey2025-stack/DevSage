import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { hackathonQueries } from '@/lib/queries';
import { PageHeader } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy } from 'lucide-react';

export function LeaderboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: leaderboardRes, isPending } = useQuery(hackathonQueries.leaderboard(slug!));
  const entries = leaderboardRes?.data ?? [];

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
        description="Current rankings based on judge scores"
        badge={
          <Badge variant="outline" className="border-[#CCFF00] text-[#CCFF00]">
            {entries.length} teams
          </Badge>
        }
      />

      {entries.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-white/20" />
            <p className="mt-4 text-white/40">No scores submitted yet</p>
            <p className="mt-1 text-sm text-white/30">
              The leaderboard will populate as judges submit their scores.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <Card
              key={entry.team_id}
              className={`border-white/10 bg-white/5 transition ${idx < 3 ? 'border-[#CCFF00]/20' : ''}`}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-lg ${
                  idx === 0 ? 'bg-[#CCFF00] text-black' :
                  idx === 1 ? 'bg-white/20 text-white' :
                  idx === 2 ? 'bg-amber-700/40 text-amber-400' :
                  'bg-white/5 text-white/40'
                }`}>
                  {entry.rank}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">{entry.team_name}</p>
                  <p className="text-xs text-white/40">
                    {entry.judges_scored} judge{entry.judges_scored !== 1 ? 's' : ''} scored
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-[#CCFF00]">{entry.total_score.toFixed(1)}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">points</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
