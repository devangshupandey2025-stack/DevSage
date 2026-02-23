import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { judgeQueries } from '@/lib/queries';
import { PageHeader } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';

export function JudgeAssignmentsPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const { data: assignmentsRes, isPending } = useQuery(judgeQueries.assignments(slug!));
  const assignments = assignmentsRes?.data ?? [];
  const [coiAssignmentId, setCoiAssignmentId] = useState<string | null>(null);
  const [coiReason, setCoiReason] = useState('');

  const coiMutation = useMutation({
    mutationFn: async ({ assignmentId, reason }: { assignmentId: string; reason: string }) => {
      return apiRequest(`/api/v1/hackathons/${slug}/judging/assignments/${assignmentId}/coi`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      toast.success('Conflict of interest declared');
      setCoiAssignmentId(null);
      setCoiReason('');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    onError: () => toast.error('Failed to declare conflict'),
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400',
    scored: 'bg-emerald-500/20 text-emerald-400',
    conflict: 'bg-red-500/20 text-red-400',
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
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => setCoiAssignmentId(assignment.id)}
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" /> COI
                    </Button>
                    <Link to={`/hackathons/${slug}/score`}>
                      <Button size="sm" className="bg-[#CCFF00] text-black hover:bg-[#CCFF00]/80">
                        Score <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* COI Declaration Dialog */}
      {coiAssignmentId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-white">Declare Conflict of Interest</h3>
            <p className="text-sm text-zinc-400">
              If you have a conflict of interest with this team, declare it and the assignment will be reassigned.
            </p>
            <textarea
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm resize-none"
              rows={3}
              placeholder="Describe the conflict..."
              value={coiReason}
              onChange={(e) => setCoiReason(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700"
                onClick={() => { setCoiAssignmentId(null); setCoiReason(''); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={!coiReason.trim() || coiMutation.isPending}
                onClick={() => coiMutation.mutate({ assignmentId: coiAssignmentId, reason: coiReason })}
              >
                {coiMutation.isPending ? 'Declaring...' : 'Declare Conflict'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
