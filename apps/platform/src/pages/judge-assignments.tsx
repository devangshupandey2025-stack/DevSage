import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { judgeQueries } from '@/lib/queries';
import { PageHeader } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function JudgeAssignmentsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: assignmentsRes, isPending } = useQuery(judgeQueries.assignments(slug!));
  const assignments = assignmentsRes?.data ?? [];

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400',
    scored: 'bg-emerald-500/20 text-emerald-400',
    skipped: 'bg-white/10 text-white/40',
  };

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assignments"
        description="Submissions assigned to you for review"
      />

      {assignments.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="mx-auto h-12 w-12 text-white/20" />
            <p className="mt-4 text-white/40">No assignments yet</p>
            <p className="mt-1 text-sm text-white/30">
              You&apos;ll see your review assignments here once an organizer assigns submissions to you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <Card key={assignment.id} className="border-white/10 bg-white/5 transition hover:border-[#CCFF00]/20">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1">
                  <p className="font-semibold text-white">{assignment.team_name}</p>
                  <p className="text-xs text-white/40">
                    Tag: <span className="font-mono text-white/60">{assignment.tag_name}</span>
                  </p>
                </div>
                <Badge className={statusColors[assignment.status] ?? 'bg-white/10 text-white/40'}>
                  {assignment.status}
                </Badge>
                {assignment.status === 'pending' && (
                  <Link to={`/hackathons/${slug}/judge`}>
                    <Button size="sm" className="bg-[#CCFF00] text-black hover:bg-[#CCFF00]/80">
                      Score <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
