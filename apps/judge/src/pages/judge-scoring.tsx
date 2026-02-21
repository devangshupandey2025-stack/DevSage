import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';
import {
  Gavel,
  Star,
  Send,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  ArrowRight,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Hackathon {
  id: string;
  slug: string;
  title: string;
  status: string;
  description?: string;
}

interface RubricCriterion {
  id: string;
  hackathon_id: string;
  name: string;
  description: string;
  max_score: number;
  weight: number;
  sort_order: number;
}

interface Assignment {
  id: string;
  submission_id: string;
  team_id: string;
  team_name: string;
  tag_name: string;
  commit_sha: string;
  round: number;
  status: string;
  assigned_at: string;
}

interface ScoreState {
  score: string;
  comment: string;
}

export function JudgeScoringPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Currently selected assignment for scoring
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [scores, setScores] = useState<Record<string, ScoreState>>({});

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        setIsLoading(true);

        const [hackathonRes, rubricRes, assignmentsRes] = await Promise.all([
          apiRequest<{ data: Hackathon }>(`/api/v1/hackathons/${slug}`),
          apiRequest<{ data: RubricCriterion[] }>(`/api/v1/hackathons/${slug}/judging/rubric`),
          apiRequest<{ data: Assignment[] }>(`/api/v1/hackathons/${slug}/judging/my-assignments`),
        ]);

        setHackathon(hackathonRes.data);
        const sortedRubric = rubricRes.data.sort((a, b) => a.sort_order - b.sort_order);
        setRubric(sortedRubric);
        setAssignments(assignmentsRes.data);
      } catch (err) {
        console.warn('Failed to load judging data:', err);
        toast.error('Failed to load judging data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  const selectAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    // Initialize empty scores
    const initialScores: Record<string, ScoreState> = {};
    rubric.forEach((c) => {
      initialScores[c.id] = { score: '', comment: '' };
    });
    setScores(initialScores);
  };

  const handleScoreChange = (criteriaId: string, value: string) => {
    if (value !== '' && isNaN(Number(value))) return;

    const criterion = rubric.find((c) => c.id === criteriaId);
    if (criterion && value !== '') {
      const numVal = Number(value);
      if (numVal < 0 || numVal > criterion.max_score) {
        toast.error(`Score must be between 0 and ${criterion.max_score}`);
        return;
      }
    }

    setScores((prev) => ({
      ...prev,
      [criteriaId]: { ...prev[criteriaId], score: value },
    }));
  };

  const handleCommentChange = (criteriaId: string, value: string) => {
    setScores((prev) => ({
      ...prev,
      [criteriaId]: { ...prev[criteriaId], comment: value },
    }));
  };

  const handleSubmit = async () => {
    if (!selectedAssignment) {
      toast.error('Please select an assignment to score');
      return;
    }

    const scoresToSubmit = Object.entries(scores)
      .filter(([_, state]) => state.score !== '')
      .map(([criteriaId, state]) => ({
        criteria_id: criteriaId,
        score: Number(state.score),
        comment: state.comment || undefined,
        assignment_id: selectedAssignment.id,
        round: selectedAssignment.round ?? 1,
      }));

    if (scoresToSubmit.length === 0) {
      toast.error('Please enter at least one score');
      return;
    }

    if (scoresToSubmit.length < rubric.length) {
      const missing = rubric.length - scoresToSubmit.length;
      toast.warning(`You still have ${missing} unscored criteria. Submitting partial scores.`);
    }

    setIsSubmitting(true);
    try {
      await apiRequest(
        `/api/v1/hackathons/${slug}/judging/submissions/${selectedAssignment.submission_id}/scores`,
        {
          method: 'POST',
          body: JSON.stringify({ scores: scoresToSubmit }),
        }
      );

      toast.success(`Successfully submitted ${scoresToSubmit.length} scores!`);

      // Update the assignment status locally
      setAssignments((prev) =>
        prev.map((a) => (a.id === selectedAssignment.id ? { ...a, status: 'scored' } : a))
      );
      setSelectedAssignment(null);
      setScores({});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit scores';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold text-white">Hackathon not found</h1>
      </div>
    );
  }

  const pendingAssignments = assignments.filter((a) => a.status === 'pending');
  const scoredAssignments = assignments.filter((a) => a.status === 'scored');

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <Gavel className="w-8 h-8 text-[#CCFF00]" />
                Judge Scoring
              </h1>
              <p className="text-gray-400 mt-1">
                {hackathon.title} &bull;{' '}
                <span className="capitalize">{hackathon.status.replace('_', ' ')}</span>
              </p>
            </div>
            <Badge variant="outline" className="border-[#CCFF00] text-[#CCFF00]">
              Judge Mode
            </Badge>
          </div>
        </div>

        {/* If no assignment is selected, show the assignment list */}
        {!selectedAssignment ? (
          <div className="space-y-6">
            {/* Pending */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#CCFF00]" />
                Pending Assignments ({pendingAssignments.length})
              </h2>
              {pendingAssignments.length === 0 ? (
                <Card className="bg-zinc-900 border-white/10">
                  <CardContent className="py-12 text-center">
                    <ClipboardCheck className="mx-auto h-12 w-12 text-white/20" />
                    <p className="mt-4 text-white/40">No pending assignments</p>
                    <p className="mt-1 text-sm text-white/30">
                      You&apos;ll see your review assignments here once an organizer assigns submissions to
                      you.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {pendingAssignments.map((assignment) => (
                    <Card
                      key={assignment.id}
                      className="bg-zinc-900 border-white/10 transition hover:border-[#CCFF00]/20"
                    >
                      <CardContent className="flex items-center gap-4 py-4">
                        <div className="flex-1">
                          <p className="font-semibold text-white">{assignment.team_name}</p>
                          <p className="text-xs text-white/40">
                            Tag: <span className="font-mono text-white/60">{assignment.tag_name || 'N/A'}</span>
                            {assignment.commit_sha && (
                              <>
                                {' '}&bull; Commit:{' '}
                                <span className="font-mono text-white/60">
                                  {assignment.commit_sha.slice(0, 7)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <Badge className="bg-amber-500/20 text-amber-400">pending</Badge>
                        <Button
                          size="sm"
                          className="bg-[#CCFF00] text-black hover:bg-[#CCFF00]/80"
                          onClick={() => selectAssignment(assignment)}
                        >
                          Score <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Scored */}
            {scoredAssignments.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Completed ({scoredAssignments.length})
                </h2>
                <div className="space-y-3">
                  {scoredAssignments.map((assignment) => (
                    <Card key={assignment.id} className="bg-zinc-900 border-white/10">
                      <CardContent className="flex items-center gap-4 py-4">
                        <div className="flex-1">
                          <p className="font-semibold text-white">{assignment.team_name}</p>
                          <p className="text-xs text-white/40">
                            Tag: <span className="font-mono text-white/60">{assignment.tag_name || 'N/A'}</span>
                          </p>
                        </div>
                        <Badge className="bg-emerald-500/20 text-emerald-400">scored</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Scoring form for selected assignment */
          <div className="space-y-6">
            <button
              onClick={() => setSelectedAssignment(null)}
              className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Assignments
            </button>

            <Card className="bg-zinc-900 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Scoring: {selectedAssignment.team_name}
                </CardTitle>
                <CardDescription>
                  Tag: <span className="font-mono">{selectedAssignment.tag_name || 'N/A'}</span>
                  {selectedAssignment.commit_sha && (
                    <>
                      {' '}&bull; Commit:{' '}
                      <span className="font-mono">{selectedAssignment.commit_sha.slice(0, 7)}</span>
                    </>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-[#CCFF00]" />
                  Rubric Criteria
                </h2>

                {rubric.length === 0 ? (
                  <Card className="bg-zinc-900 border-white/10">
                    <CardContent className="p-6 text-center text-gray-400">
                      No rubric criteria defined for this hackathon.
                    </CardContent>
                  </Card>
                ) : (
                  rubric.map((criterion) => (
                    <Card key={criterion.id} className="bg-zinc-900 border-white/10 overflow-hidden">
                      <div className="p-6 space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h3 className="font-medium text-lg text-white">{criterion.name}</h3>
                            <p className="text-sm text-gray-400 mt-1">{criterion.description}</p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="bg-white/10 text-white hover:bg-white/20"
                          >
                            Max: {criterion.max_score}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                          <div className="md:col-span-1">
                            <label
                              className="text-xs font-medium text-gray-500 mb-1.5 block"
                              htmlFor={`score-${criterion.id}`}
                            >
                              Score (0-{criterion.max_score})
                            </label>
                            <Input
                              id={`score-${criterion.id}`}
                              type="number"
                              min="0"
                              max={criterion.max_score}
                              value={scores[criterion.id]?.score || ''}
                              onChange={(e) => handleScoreChange(criterion.id, e.target.value)}
                              className="bg-black border-white/10 text-white text-center font-bold text-lg h-12"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label
                              className="text-xs font-medium text-gray-500 mb-1.5 block"
                              htmlFor={`comment-${criterion.id}`}
                            >
                              Comments (Optional)
                            </label>
                            <textarea
                              id={`comment-${criterion.id}`}
                              value={scores[criterion.id]?.comment || ''}
                              onChange={(e) => handleCommentChange(criterion.id, e.target.value)}
                              className="flex min-h-[48px] w-full rounded-md border border-white/10 bg-black px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-white resize-none"
                              placeholder="Add feedback..."
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || rubric.length === 0}
                    className="bg-[#CCFF00] text-black hover:bg-[#b3e600] font-bold px-8 py-6 text-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Submit Scores
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card className="bg-zinc-900 border-white/10 sticky top-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Scoring Guide</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-gray-400">
                    <div className="flex gap-3">
                      <div className="bg-white/5 p-2 rounded-lg h-fit">
                        <AlertCircle className="w-4 h-4 text-[#CCFF00]" />
                      </div>
                      <div>
                        <p className="text-white font-medium mb-1">Independent Scoring</p>
                        <p>Each criterion is scored independently. All criteria should be scored.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="bg-white/5 p-2 rounded-lg h-fit">
                        <CheckCircle2 className="w-4 h-4 text-[#CCFF00]" />
                      </div>
                      <div>
                        <p className="text-white font-medium mb-1">Final Submission</p>
                        <p>Scores can be updated by scoring the same assignment again.</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                      <h4 className="text-white font-medium mb-2">Rubric Summary</h4>
                      <ul className="space-y-2">
                        {rubric.map((c) => (
                          <li key={c.id} className="flex justify-between text-xs">
                            <span>{c.name}</span>
                            <span className="text-white">{c.weight}x</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
