import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
import { PageHeader } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react';

interface ScoreEntry {
  submission_id: string;
  criteria_id: string;
  score: number;
  comment: string | null;
  round: number;
  scored_at: string;
  criterion_name: string;
  max_score: number;
  weight: number;
  submission_title: string;
  team_name: string;
}

interface GroupedScore {
  team_name: string;
  submission_id: string;
  round: number;
  scored_at: string;
  criteria: Array<{
    name: string;
    score: number;
    max_score: number;
    weight: number;
    comment: string | null;
  }>;
  totalWeighted: number;
  maxWeighted: number;
}

function groupScores(entries: ScoreEntry[]): GroupedScore[] {
  const map = new Map<string, GroupedScore>();

  for (const e of entries) {
    const key = `${e.submission_id}`;
    if (!map.has(key)) {
      map.set(key, {
        team_name: e.team_name,
        submission_id: e.submission_id,
        round: e.round,
        scored_at: e.scored_at,
        criteria: [],
        totalWeighted: 0,
        maxWeighted: 0,
      });
    }
    const group = map.get(key)!;
    group.criteria.push({
      name: e.criterion_name,
      score: e.score,
      max_score: e.max_score,
      weight: e.weight,
      comment: e.comment,
    });
    group.totalWeighted += (e.score / e.max_score) * e.weight * 100;
    group.maxWeighted += e.weight * 100;
    if (e.scored_at > group.scored_at) group.scored_at = e.scored_at;
  }

  return Array.from(map.values()).sort((a, b) => b.scored_at.localeCompare(a.scored_at));
}

export function MyScoresPage() {
  const { slug } = useParams<{ slug: string }>();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      try {
        const res = await apiRequest<{ data: ScoreEntry[] }>(`/api/v1/hackathons/${slug}/judging/my-scores`);
        setScores(res.data ?? []);
      } catch {
        // graceful
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`ms-${String(i)}`} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const grouped = groupScores(scores);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Scores"
        description={`${grouped.length} submission${grouped.length !== 1 ? 's' : ''} scored`}
      />

      {grouped.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="mx-auto h-12 w-12 text-white/20" />
            <p className="mt-4 text-white/40">No scores submitted yet</p>
            <p className="mt-1 text-sm text-white/30">
              Your submitted scores will appear here for review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => {
            const isExpanded = expandedId === group.submission_id;
            const pct = group.maxWeighted > 0 ? Math.round((group.totalWeighted / group.maxWeighted) * 100) : 0;

            return (
              <Card
                key={group.submission_id}
                className="border-white/10 bg-white/5 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : group.submission_id)}
                  className="w-full text-left"
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{group.team_name}</p>
                      <p className="text-xs text-white/40">
                        Round {group.round} &bull; {new Date(group.scored_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 tabular-nums">
                      {pct}%
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-white/30" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white/30" />
                    )}
                  </CardContent>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/6 px-6 py-4 space-y-3 bg-white/2">
                    {group.criteria.map((c, i) => (
                      <div key={`${group.submission_id}-${String(i)}`} className="flex items-start gap-4">
                        <Star className="h-3.5 w-3.5 text-[#CCFF00] mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-white/70">{c.name}</p>
                            <span className="text-sm font-bold tabular-nums text-white/60">
                              {c.score}/{c.max_score}
                              <span className="text-[10px] text-white/20 ml-1">{c.weight}×</span>
                            </span>
                          </div>
                          {c.comment && (
                            <p className="text-xs text-white/30 mt-1 italic">{c.comment}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
