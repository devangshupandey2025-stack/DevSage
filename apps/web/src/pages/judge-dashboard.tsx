import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Gavel, Github, Star, Send, GitCommit, Tag } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

/* ──────────── Interfaces ──────────── */

interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  max_score: number;
  weight: number;
  sort_order: number;
}

interface JudgeAssignment {
  id: string;
  judge_id: string;
  team_id: string;
  team_name: string;
  repo_full_name: string | null;
  submission_tag: string | null;
  submission_commit_sha: string | null;
  status: string;
}

interface Hackathon {
  id: string;
  slug: string;
  title: string;
  status: string;
}

interface Judge {
  id: string;
  user_id: string;
  assignments?: JudgeAssignment[];
}

/* ──────────── Components ──────────── */

function AssignmentCard({ 
  assignment, 
  rubric, 
  onScoreSubmit 
}: { 
  assignment: JudgeAssignment; 
  rubric: RubricCriterion[];
  onScoreSubmit: (assignmentId: string, scores: Record<string, number>, comments: Record<string, string>) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleScoreChange = (criterionId: string, value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setScores(prev => ({ ...prev, [criterionId]: numValue }));
    }
  };

  const handleCommentChange = (criterionId: string, value: string) => {
    setComments(prev => ({ ...prev, [criterionId]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onScoreSubmit(assignment.id, scores, comments);
      setIsExpanded(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  const totalMaxScore = rubric.reduce((acc, c) => acc + c.max_score, 0);
  const currentTotalScore = Object.values(scores).reduce((acc, s) => acc + s, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/3 transition-colors hover:border-[#CCFF00]/30"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white">{assignment.team_name}</h3>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/50">
              {assignment.repo_full_name && (
                <a 
                  href={`https://github.com/${assignment.repo_full_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-[#CCFF00] transition-colors"
                >
                  <Github className="h-4 w-4" />
                  {assignment.repo_full_name}
                </a>
              )}
              {assignment.submission_tag && (
                <span className="flex items-center gap-1.5">
                  <Tag className="h-4 w-4" />
                  {assignment.submission_tag}
                </span>
              )}
              {assignment.submission_commit_sha && (
                <span className="flex items-center gap-1.5 font-mono">
                  <GitCommit className="h-4 w-4" />
                  {assignment.submission_commit_sha.substring(0, 7)}
                </span>
              )}
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={`border-white/10 ${assignment.status === 'completed' ? 'bg-[#CCFF00]/20 text-[#CCFF00]' : 'bg-white/5 text-white/50'}`}
          >
            {assignment.status === 'completed' ? 'Scored' : 'Pending'}
          </Badge>
        </div>

        <div className="mt-6">
          <Button 
            onClick={() => setIsExpanded(!isExpanded)}
            variant={isExpanded ? "secondary" : "default"}
            className={isExpanded ? "bg-white/10 text-white hover:bg-white/20" : "bg-[#CCFF00] text-black hover:bg-[#b3e600]"}
          >
            {isExpanded ? 'Cancel Scoring' : 'Score Submission'}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/10 bg-white/5"
          >
            <div className="p-6 space-y-8">
              {rubric.map((criterion) => (
                <div key={criterion.id} className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor={`score-${criterion.id}`} className="text-sm font-medium text-white">
                      {criterion.name}
                      <span className="ml-2 text-xs text-white/40">
                        (Max: {criterion.max_score})
                      </span>
                    </label>
                    <span className="text-xs font-mono text-[#CCFF00]">
                      {scores[criterion.id] || 0} / {criterion.max_score}
                    </span>
                  </div>
                  
                  <p className="text-xs text-white/50">{criterion.description}</p>
                  
                  <div className="grid gap-4 sm:grid-cols-[100px_1fr]">
                    <Input
                      id={`score-${criterion.id}`}
                      type="number"
                      min={0}
                      max={criterion.max_score}
                      value={scores[criterion.id] || ''}
                      onChange={(e) => handleScoreChange(criterion.id, e.target.value)}
                      className="bg-black/20 border-white/10 text-white focus:border-[#CCFF00]/50"
                      placeholder="0"
                    />
                    <textarea
                      value={comments[criterion.id] || ''}
                      onChange={(e) => handleCommentChange(criterion.id, e.target.value)}
                      placeholder="Optional comment..."
                      className="flex min-h-[38px] w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-[#CCFF00]/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      rows={1}
                    />
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between border-t border-white/10 pt-6">
                <div className="text-sm text-white/50">
                  Total Score: <span className="text-white font-bold">{currentTotalScore}</span> / {totalMaxScore}
                </div>
                <Button 
                  onClick={handleSubmit} 
                  disabled={submitting}
                  className="bg-[#CCFF00] text-black hover:bg-[#b3e600]"
                >
                  {submitting ? (
                    <span className="animate-pulse">Submitting...</span>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Scores
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function JudgeDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/3 p-6">
          <div className="flex justify-between">
            <div className="space-y-3">
              <Skeleton className="h-6 w-48 bg-white/10" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-24 bg-white/5" />
                <Skeleton className="h-4 w-24 bg-white/5" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 bg-white/10" />
          </div>
          <Skeleton className="mt-6 h-10 w-32 bg-white/10" />
        </div>
      ))}
    </div>
  );
}

/* ──────────── Main Page ──────────── */

export function JudgeDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([]);
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!slug || !user) return;

      try {
        const hackathonRes = await apiRequest<{ data: Hackathon }>(`/api/v1/hackathons/${slug}`);
        setHackathon(hackathonRes.data);

        const rubricRes = await apiRequest<{ data: RubricCriterion[] }>(`/api/v1/hackathons/${slug}/rubric`);
        setRubric(rubricRes.data);

        try {
          const judgesRes = await apiRequest<{ data: Judge[] }>(`/api/v1/hackathons/${slug}/judges`);
          const myJudgeProfile = judgesRes.data.find(j => j.user_id === user.id);
          
          if (myJudgeProfile?.assignments) {
            setAssignments(myJudgeProfile.assignments);
          } else {
            setAssignments([]);
          }
        } catch (err) {
          console.warn('Failed to fetch judges list:', err);
        }

      } catch (error) {
        console.error('Failed to load judge dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [slug, user]);

  const handleScoreSubmit = async (assignmentId: string, scores: Record<string, number>, comments: Record<string, string>) => {
    if (!slug) return;

    try {
      const promises = Object.entries(scores).map(async ([criteriaId, score]) => {
        await apiRequest(`/api/v1/hackathons/${slug}/scores`, {
          method: 'POST',
          body: JSON.stringify({
            submissionId: assignmentId,
            criteriaId,
            score,
            comment: comments[criteriaId]
          })
        });
      });

      await Promise.all(promises);
      toast.success('Scores submitted successfully');
      
      setAssignments(prev => prev.map(a => 
        a.id === assignmentId ? { ...a, status: 'completed' } : a
      ));
      
    } catch (error) {
      console.error('Failed to submit scores:', error);
      toast.error('Failed to submit scores');
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 bg-white/10" />
            <Skeleton className="h-4 w-32 bg-white/5" />
          </div>
        </div>
        <JudgeDashboardSkeleton />
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-white">Hackathon not found</h2>
        <Link to="/dashboard" className="mt-4 text-[#CCFF00] hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
      >
        <div className="space-y-2">
          <Link 
            to={`/hackathons/${slug}`}
            className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Hackathon
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Judge Panel
            <span className="ml-3 inline-block rounded-full bg-[#CCFF00]/10 px-3 py-1 text-sm font-bold text-[#CCFF00] align-middle">
              {hackathon.title}
            </span>
          </h1>
          <p className="text-white/50">
            Review and score submissions based on the rubric below.
          </p>
        </div>
      </motion.div>

      {/* Content */}
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Gavel className="h-5 w-5 text-[#CCFF00]" />
              Assigned Teams
            </h2>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-white/50">
              {assignments.length} Assigned
            </Badge>
          </div>

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-20 text-center">
              <Gavel className="h-10 w-10 text-white/20" />
              <p className="mt-4 text-sm text-white/40">No teams assigned for judging yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  rubric={rubric}
                  onScoreSubmit={handleScoreSubmit}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar / Rubric Reference */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-white">
              <Star className="h-4 w-4 text-[#CCFF00]" />
              Rubric Criteria
            </h3>
            {rubric.length === 0 ? (
              <p className="text-sm text-white/40">Rubric not configured yet</p>
            ) : (
              <div className="space-y-4">
                {rubric.map((criterion) => (
                  <div key={criterion.id} className="space-y-1 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between text-sm font-medium text-white">
                      <span>{criterion.name}</span>
                      <span className="text-white/40">{criterion.max_score} pts</span>
                    </div>
                    <p className="text-xs text-white/40 line-clamp-2">
                      {criterion.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
