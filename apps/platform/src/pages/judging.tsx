import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader, EmptyState } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Scale,
  UserPlus,
  Trophy,
  Star,
  Users,
  Plus,
  Shuffle,
  Trash2,
  Loader2,
  Gavel,
  ArrowLeft,
  ArrowRight,
  Send,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  BarChart3,
} from 'lucide-react';

interface Judge {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  image: string | null;
  status: string;
}

interface LeaderboardEntry {
  rank: number;
  team_name: string;
  team_id: string;
  score: number;
  judges_completed: number;
  total_judges: number;
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

interface ScoreInput {
  score: string;
  comment: string;
}

interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  max_score: number;
  weight: number;
  sort_order: number;
}

// ─── Outlier Detection Helpers ───────────────────────────────────────────────

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getOutlierInfo(score: number, median: number): { isOutlier: boolean; deviation: number } {
  if (median === 0) return { isOutlier: false, deviation: 0 };
  const deviation = ((score - median) / median) * 100;
  return { isOutlier: Math.abs(deviation) > 30, deviation: Math.round(deviation) };
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

// ─── Scoring Progress Panel ──────────────────────────────────────────────────

interface JudgeAssignment {
  id: string;
  status: string;
}

interface JudgeProgress {
  judge: Judge;
  assigned: number;
  completed: number;
  pending: number;
  conflicted: number;
}

function ScoringProgressPanel({
  judges,
  slug,
}: {
  judges: Judge[];
  slug: string;
}) {
  const [progress, setProgress] = useState<JudgeProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      const acceptedJudges = judges.filter((j) => j.status === 'accepted');
      if (acceptedJudges.length === 0) {
        setProgress([]);
        setLoading(false);
        return;
      }

      const results = await Promise.allSettled(
        acceptedJudges.map((j) =>
          apiRequest<{ data: JudgeAssignment[] }>(`/api/v1/hackathons/${slug}/judging/judges/${j.id}/assignments`)
        )
      );

      const progressData: JudgeProgress[] = acceptedJudges.map((judge, i) => {
        const result = results[i];
        const assignments = result.status === 'fulfilled' ? (result.value.data ?? []) : [];
        return {
          judge,
          assigned: assignments.length,
          completed: assignments.filter((a) => a.status === 'scored').length,
          pending: assignments.filter((a) => a.status === 'pending').length,
          conflicted: assignments.filter((a) => a.status === 'conflict').length,
        };
      });

      setProgress(progressData);
      setLoading(false);
    }

    fetchProgress();
  }, [judges, slug]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`sp-${String(i)}`} className="h-16 bg-white/6 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (progress.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No accepted judges"
        description="Progress will appear once judges accept their invites and receive assignments."
      />
    );
  }

  const totalAssigned = progress.reduce((s, p) => s + p.assigned, 0);
  const totalCompleted = progress.reduce((s, p) => s + p.completed, 0);
  const overallPct = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="rounded-2xl border border-white/6 bg-white/2 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white/60">Overall Scoring Progress</h3>
          <span className="text-2xl font-black text-[#CCFF00]">{overallPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #CCFF00, #34D399)' }}
            initial={{ width: 0 }}
            animate={{ width: `${overallPct}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
          <span>{totalCompleted} completed</span>
          <span>{totalAssigned - totalCompleted} remaining</span>
          <span>{progress.length} judges</span>
        </div>
      </div>

      {/* Per-judge table */}
      <div className="rounded-2xl border border-white/6 overflow-hidden">
        <div className="grid grid-cols-[1fr,80px,80px,80px,120px] gap-4 px-5 py-3 bg-white/3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/20">
          <span>Judge</span>
          <span className="text-center">Assigned</span>
          <span className="text-center">Scored</span>
          <span className="text-center">Pending</span>
          <span className="text-right">Progress</span>
        </div>
        <motion.div variants={container} initial="hidden" animate="show">
          {progress
            .sort((a, b) => (b.assigned > 0 ? b.completed / b.assigned : 0) - (a.assigned > 0 ? a.completed / a.assigned : 0))
            .map((p) => {
              const pct = p.assigned > 0 ? Math.round((p.completed / p.assigned) * 100) : 0;
              const statusLabel = p.assigned === 0 ? 'No assignments' : pct === 100 ? 'Complete' : pct > 0 ? 'In Progress' : 'Not Started';
              const statusColor = pct === 100 ? '#34D399' : pct > 0 ? '#FBBF24' : 'rgba(255,255,255,0.2)';

              return (
                <motion.div
                  key={p.judge.id}
                  variants={item}
                  className="grid grid-cols-[1fr,80px,80px,80px,120px] gap-4 items-center px-5 py-3 border-t border-white/4 hover:bg-white/2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {p.judge.image ? (
                      <img src={p.judge.image} alt="" className="h-7 w-7 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-[10px] font-bold text-violet-400 shrink-0">
                        {p.judge.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/70 truncate">{p.judge.display_name}</p>
                    </div>
                  </div>
                  <span className="text-sm text-white/40 text-center tabular-nums">{p.assigned}</span>
                  <span className="text-sm font-bold text-center tabular-nums" style={{ color: statusColor }}>{p.completed}</span>
                  <span className="text-sm text-white/30 text-center tabular-nums">{p.pending}</span>
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: statusColor }}
                      />
                    </div>
                    <span className="text-[10px] font-bold w-8 text-right tabular-nums" style={{ color: statusColor }}>
                      {pct}%
                    </span>
                  </div>
                </motion.div>
              );
            })}
        </motion.div>
      </div>

      {/* Alert for incomplete scoring */}
      {totalAssigned > 0 && totalCompleted < totalAssigned && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-3 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300/80">
            {totalAssigned - totalCompleted} assignment{totalAssigned - totalCompleted !== 1 ? 's' : ''} still pending.
            {progress.filter((p) => p.assigned > 0 && p.completed === 0).length > 0 && (
              <> <strong>{progress.filter((p) => p.assigned > 0 && p.completed === 0).length} judge{progress.filter((p) => p.assigned > 0 && p.completed === 0).length !== 1 ? 's have' : ' has'} not started scoring.</strong></>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Conflicts Panel ──────────────────────────────────────────────────────────

interface ConflictEntry {
  assignment_id: string;
  team_id: string;
  judge_id: string;
  team_name: string;
  judge_name: string;
  judge_email: string;
  declared_at: string;
}

function ConflictsPanel({
  conflicts,
  judges,
  slug,
  onRefresh,
}: {
  conflicts: ConflictEntry[];
  judges: Judge[];
  slug: string;
  onRefresh: () => void;
}) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<ConflictEntry | null>(null);
  const [selectedNewJudge, setSelectedNewJudge] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Group conflicts by judge
  const groupedByJudge = conflicts.reduce<Record<string, { judge: { id: string; name: string; email: string }; conflicts: ConflictEntry[] }>>((acc, c) => {
    if (!acc[c.judge_id]) {
      acc[c.judge_id] = { judge: { id: c.judge_id, name: c.judge_name, email: c.judge_email }, conflicts: [] };
    }
    acc[c.judge_id].conflicts.push(c);
    return acc;
  }, {});

  // Available judges for reassignment (exclude the conflicted judge)
  const getAvailableJudges = (excludeJudgeId: string) =>
    judges.filter((j) => j.user_id !== excludeJudgeId && j.status === 'accepted');

  async function handleReassign() {
    if (!selectedConflict || !selectedNewJudge) return;
    setReassigning(true);
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/judging/assignments/${selectedConflict.assignment_id}/reassign`, {
        method: 'POST',
        body: JSON.stringify({ new_judge_id: selectedNewJudge }),
      });
      toast.success('Assignment reassigned successfully');
      setReassignOpen(false);
      setSelectedConflict(null);
      setSelectedNewJudge('');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reassign');
    } finally {
      setReassigning(false);
    }
  }

  if (conflicts.length === 0) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No conflicts declared"
        description="When judges declare a conflict of interest with an assigned team, it will appear here for you to reassign."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          Conflict of Interest Declarations
        </h3>
        <p className="text-sm text-white/40 mt-1">
          {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} declared across {Object.keys(groupedByJudge).length} judge{Object.keys(groupedByJudge).length !== 1 ? 's' : ''}. Reassign affected submissions to other judges.
        </p>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        {Object.values(groupedByJudge).map(({ judge, conflicts: judgeConflicts }) => (
          <motion.div
            key={judge.id}
            variants={item}
            className="rounded-2xl border border-red-500/15 bg-red-500/3 overflow-hidden"
          >
            {/* Judge header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-red-500/10 bg-red-500/5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-sm font-bold text-red-400">
                {judge.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/80 truncate">{judge.name || judge.email}</p>
                <p className="text-xs text-white/30 truncate">{judge.email}</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                {judgeConflicts.length} conflict{judgeConflicts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Conflict items */}
            <div className="divide-y divide-red-500/8">
              {judgeConflicts.map((conflict) => (
                <div key={conflict.assignment_id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-4 w-4 text-red-400/60 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white/80">{conflict.team_name}</p>
                      <p className="text-xs text-white/25">
                        Declared {new Date(conflict.declared_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setSelectedConflict(conflict);
                      setSelectedNewJudge('');
                      setReassignOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-[#CCFF00]/10 px-3 py-1.5 text-xs font-bold text-[#CCFF00] transition hover:bg-[#CCFF00]/20"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Reassign
                  </motion.button>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Reassign Dialog */}
      <Dialog open={reassignOpen} onOpenChange={(open) => { setReassignOpen(open); if (!open) { setSelectedConflict(null); setSelectedNewJudge(''); } }}>
        <DialogContent className="border-white/8 bg-black/95 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-black">Reassign Submission</DialogTitle>
            <DialogDescription className="text-white/35">
              Reassign <strong className="text-white/60">{selectedConflict?.team_name}</strong> from{' '}
              <strong className="text-red-400">{selectedConflict?.judge_name || selectedConflict?.judge_email}</strong>{' '}
              to another judge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[300px] overflow-y-auto">
            {selectedConflict && getAvailableJudges(selectedConflict.judge_id).map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => setSelectedNewJudge(j.user_id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                  selectedNewJudge === j.user_id
                    ? 'border-[#CCFF00] bg-[#CCFF00]/5'
                    : 'border-white/8 hover:border-white/15'
                }`}
              >
                {j.image ? (
                  <img src={j.image} alt="" className="h-8 w-8 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-xs font-bold text-violet-400">
                    {j.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                )}
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80 truncate">{j.display_name}</p>
                  <p className="text-xs text-white/30 truncate">{j.email}</p>
                </div>
              </button>
            ))}
            {selectedConflict && getAvailableJudges(selectedConflict.judge_id).length === 0 && (
              <p className="text-sm text-white/40 text-center py-4">No other accepted judges available.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)} className="border-white/10 bg-transparent text-white/60 hover:bg-white/6 hover:text-white">
              Cancel
            </Button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleReassign}
              disabled={reassigning || !selectedNewJudge}
              className="rounded-lg bg-[#CCFF00] px-5 py-2 text-sm font-bold text-black transition hover:bg-white disabled:opacity-50"
            >
              {reassigning ? 'Reassigning…' : 'Reassign'}
            </motion.button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function JudgingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { hackathonRoles, refreshToken } = useAuth();
  const isJudge = slug ? (hackathonRoles[slug] || []).includes('judge') : false;
  const [judges, setJudges] = useState<Judge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'judges' | 'rubric' | 'scoring' | 'conflicts' | 'progress'>('leaderboard');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [createAccountDialog, setCreateAccountDialog] = useState(false);
  const [newJudgeName, setNewJudgeName] = useState('');
  const [newJudgeEmail, setNewJudgeEmail] = useState('');
  const [newJudgeTempPwd, setNewJudgeTempPwd] = useState('');
  const [conflicts, setConflicts] = useState<Array<{ assignment_id: string; team_id: string; judge_id: string; team_name: string; judge_name: string; judge_email: string; declared_at: string }>>([]);
  const [rubricDialogOpen, setRubricDialogOpen] = useState(false);
  const [newCriterion, setNewCriterion] = useState({ name: '', description: '', max_score: '10', weight: '1' });
  const [isCreatingCriterion, setIsCreatingCriterion] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Judge scoring state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, ScoreInput>>({});
  const [isSubmittingScores, setIsSubmittingScores] = useState(false);

  // Outlier detection state
  const [showOutliers, setShowOutliers] = useState(true);
  const [excludedTeams, setExcludedTeams] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!slug) return;
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    try {
      const promises: Promise<unknown>[] = [
        apiRequest<{ data: Judge[] }>(`/api/v1/hackathons/${slug}/judging/judges`),
        apiRequest<{ data: LeaderboardEntry[] }>(`/api/v1/hackathons/${slug}/judging/leaderboard`),
        apiRequest<{ data: RubricCriterion[] }>(`/api/v1/hackathons/${slug}/judging/rubric`),
      ];
      // Fetch judge assignments if user is a judge
      if (isJudge) {
        promises.push(apiRequest<{ data: Assignment[] }>(`/api/v1/hackathons/${slug}/judging/my-assignments`));
      }

      const [judgesRes, leaderboardRes, rubricRes, assignmentsRes] = await Promise.allSettled(promises) as PromiseSettledResult<any>[];
      if (judgesRes.status === 'fulfilled') setJudges(judgesRes.value.data ?? []);
      if (leaderboardRes.status === 'fulfilled') setLeaderboard(leaderboardRes.value.data ?? []);
      if (rubricRes.status === 'fulfilled') setRubric(rubricRes.value.data ?? []);
      if (assignmentsRes?.status === 'fulfilled') setAssignments(assignmentsRes.value.data ?? []);

      // Fetch COI conflicts
      try {
        const coiRes = await apiRequest<{ data: typeof conflicts }>(`/api/v1/hackathons/${slug}/judging/coi`);
        setConflicts(coiRes.data ?? []);
      } catch { /* may not be organizer */ }
    } catch (_err) {
      // graceful
    } finally {
      setLoading(false);
    }
  };

  // --- Scoring helpers ---
  const selectAssignmentForScoring = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    const initial: Record<string, ScoreInput> = {};
    rubric.forEach((c) => { initial[c.id] = { score: '', comment: '' }; });
    setScoreInputs(initial);
  };

  const handleScoreInputChange = (criteriaId: string, value: string) => {
    if (value !== '' && isNaN(Number(value))) return;
    const criterion = rubric.find((c) => c.id === criteriaId);
    if (criterion && value !== '') {
      const numVal = Number(value);
      if (numVal < 0 || numVal > criterion.max_score) {
        toast.error(`Score must be between 0 and ${criterion.max_score}`);
        return;
      }
    }
    setScoreInputs((prev) => ({ ...prev, [criteriaId]: { ...prev[criteriaId], score: value } }));
  };

  const handleCommentInputChange = (criteriaId: string, value: string) => {
    setScoreInputs((prev) => ({ ...prev, [criteriaId]: { ...prev[criteriaId], comment: value } }));
  };

  const submitScores = async () => {
    if (!selectedAssignment) return;
    const scoresToSubmit = Object.entries(scoreInputs)
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
      toast.warning(`${rubric.length - scoresToSubmit.length} criteria unscored. Submitting partial scores.`);
    }

    setIsSubmittingScores(true);
    try {
      await apiRequest(
        `/api/v1/hackathons/${slug}/judging/submissions/${selectedAssignment.submission_id}/scores`,
        { method: 'POST', body: JSON.stringify({ scores: scoresToSubmit }) }
      );
      toast.success(`Submitted ${scoresToSubmit.length} scores!`);
      setAssignments((prev) =>
        prev.map((a) => (a.id === selectedAssignment.id ? { ...a, status: 'scored' } : a))
      );
      setSelectedAssignment(null);
      setScoreInputs({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit scores');
    } finally {
      setIsSubmittingScores(false);
    }
  };

  const inviteJudge = async () => {
    if (!inviteUserId.trim()) return;
    try {
      const res = await apiRequest<{ data: { already_invited?: boolean; message?: string; self_accepted?: boolean; invite_status?: string } }>(`/api/v1/hackathons/${slug}/judging/judges`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteUserId }),
      });
      if (res.data?.already_invited) {
        toast.info(res.data.message ?? 'Judge already invited — invite email re-sent.');
      } else if (res.data?.self_accepted) {
        toast.success('You have been added as a judge!');
        // Refresh auth so isJudge picks up immediately
        await refreshToken();
      } else {
        toast.success('Judge invited!');
      }
      setInviteDialogOpen(false);
      setInviteUserId('');
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite judge';
      toast.error(message);
    }
  };

  const createJudgeAccount = async () => {
    if (!newJudgeName.trim() || !newJudgeEmail.trim() || !newJudgeTempPwd.trim()) {
      toast.error('All fields are required');
      return;
    }
    if (newJudgeTempPwd.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/judging/judges/create-account`, {
        method: 'POST',
        body: JSON.stringify({ name: newJudgeName, email: newJudgeEmail, temp_password: newJudgeTempPwd }),
      });
      toast.success('Judge account created with credentials');
      setCreateAccountDialog(false);
      setNewJudgeName('');
      setNewJudgeEmail('');
      setNewJudgeTempPwd('');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create judge account');
    }
  };

  const createCriterion = async () => {
    if (!newCriterion.name.trim()) {
      toast.error('Criterion name is required');
      return;
    }
    setIsCreatingCriterion(true);
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/judging/rubric`, {
        method: 'POST',
        body: JSON.stringify({
          name: newCriterion.name,
          description: newCriterion.description,
          max_score: Number(newCriterion.max_score) || 10,
          weight: Number(newCriterion.weight) || 1,
          sort_order: rubric.length + 1,
        }),
      });
      toast.success('Criterion added!');
      setRubricDialogOpen(false);
      setNewCriterion({ name: '', description: '', max_score: '10', weight: '1' });
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create criterion';
      toast.error(message);
    } finally {
      setIsCreatingCriterion(false);
    }
  };

  const deleteCriterion = async (criterionId: string) => {
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/judging/rubric/${criterionId}`, {
        method: 'DELETE',
      });
      toast.success('Criterion deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete criterion');
    }
  };

  const assignSubmissions = async () => {
    setIsAssigning(true);
    try {
      const res = await apiRequest<{ data: { assigned: number } }>(`/api/v1/hackathons/${slug}/judging/assign`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const count = res.data?.assigned ?? 0;
      if (count > 0) {
        toast.success(`${count} submission${count === 1 ? '' : 's'} assigned to judges (round-robin)!`);
      } else {
        toast.warning('No eligible submissions found to assign. Make sure submissions are marked as final.');
      }
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign submissions';
      toast.error(message);
    } finally {
      setIsAssigning(false);
    }
  };

  const acceptJudgeInvite = async (judgeId: string) => {
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/judging/judges/${judgeId}/accept`, {
        method: 'POST',
      });
      toast.success('Judge invite accepted!');
      // Refresh auth in case the accepted judge is the current user
      await refreshToken();
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invite');
    }
  };

  const pendingAssignments = assignments.filter((a) => a.status === 'pending');
  const scoredAssignments = assignments.filter((a) => a.status === 'scored');

  const tabs: Array<{ key: typeof activeTab; label: string; icon: typeof Trophy; badge?: number }> = [
    { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { key: 'judges', label: 'Judges', icon: Users },
    { key: 'rubric', label: 'Rubric', icon: Star },
  ];
  // Add scoring tab for judges
  if (isJudge) {
    tabs.push({ key: 'scoring', label: 'Scoring', icon: Gavel, badge: pendingAssignments.length || undefined });
  }
  // Add conflicts tab (always show for organizers)
  tabs.push({ key: 'conflicts', label: 'Conflicts', icon: AlertCircle, badge: conflicts.length || undefined });
  // Add progress tab
  tabs.push({ key: 'progress', label: 'Progress', icon: BarChart3 });

  return (
    <div>
      <PageHeader
        title="Judging"
        description="Manage judges, rubric criteria, and view the leaderboard."
        actions={
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={assignSubmissions}
              disabled={isAssigning}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
              Assign Submissions
            </motion.button>
             <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-full bg-[#CCFF00] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white"
                >
                  <UserPlus className="h-4 w-4" />
                  Invite Judge
                </motion.button>
              </DialogTrigger>
            <DialogContent className="border-white/8 bg-black/95 backdrop-blur-xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white text-xl font-black">Invite Judge</DialogTitle>
                <DialogDescription className="text-white/35">
                  Enter the email address of the person you want to invite as a judge.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                  placeholder="judge@example.com"
                  type="email"
                  className="border-white/8 bg-white/3 text-white placeholder:text-white/20"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)} className="border-white/10 bg-transparent text-white/60 hover:bg-white/6 hover:text-white">Cancel</Button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={inviteJudge} className="rounded-lg bg-[#CCFF00] px-5 py-2 text-sm font-bold text-black transition hover:bg-white">
                  Send Invite
                </motion.button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

            {/* Create Judge Account with credentials */}
            <Dialog open={createAccountDialog} onOpenChange={setCreateAccountDialog}>
              <DialogTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm font-bold text-white/60 transition hover:border-[#CCFF00]/30 hover:text-[#CCFF00]"
                >
                  <Plus className="h-4 w-4" />
                  Create Account
                </motion.button>
              </DialogTrigger>
              <DialogContent className="border-white/8 bg-black/95 backdrop-blur-xl sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-white text-xl font-black">Create Judge Account</DialogTitle>
                  <DialogDescription className="text-white/35">
                    Create a judge account with temporary credentials. The judge must change their password on first login.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                  <Input
                    value={newJudgeName}
                    onChange={(e) => setNewJudgeName(e.target.value)}
                    placeholder="Full name"
                    className="border-white/8 bg-white/3 text-white placeholder:text-white/20"
                  />
                  <Input
                    value={newJudgeEmail}
                    onChange={(e) => setNewJudgeEmail(e.target.value)}
                    placeholder="judge@example.com"
                    type="email"
                    className="border-white/8 bg-white/3 text-white placeholder:text-white/20"
                  />
                  <Input
                    value={newJudgeTempPwd}
                    onChange={(e) => setNewJudgeTempPwd(e.target.value)}
                    placeholder="Temporary password (min 8 chars)"
                    type="text"
                    className="border-white/8 bg-white/3 text-white placeholder:text-white/20"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateAccountDialog(false)} className="border-white/10 bg-transparent text-white/60 hover:bg-white/6 hover:text-white">Cancel</Button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={createJudgeAccount} className="rounded-lg bg-[#CCFF00] px-5 py-2 text-sm font-bold text-black transition hover:bg-white">
                    Create Account
                  </motion.button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-xl border border-white/ bg-white/2 p-1 mb-6 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-[#CCFF00]/10 text-[#CCFF00]'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/4'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-1 rounded-full bg-[#CCFF00]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#CCFF00]">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`s-${String(i)}`} className="h-16 bg-white/6 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Leaderboard */}
          {activeTab === 'leaderboard' && (
            leaderboard.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No scores yet"
                description="Scores will appear once judges start evaluating submissions."
              />
            ) : (() => {
              const scores = leaderboard.filter((e) => !excludedTeams.has(e.team_id)).map((e) => e.score);
              const median = computeMedian(scores);
              const outlierCount = leaderboard.filter((e) => !excludedTeams.has(e.team_id) && getOutlierInfo(e.score, median).isOutlier).length;

              return (
                <div className="space-y-4">
                  {/* Outlier controls */}
                  {outlierCount > 0 && (
                    <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-3">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                        <p className="text-xs text-amber-300/80">
                          <strong>{outlierCount} outlier{outlierCount !== 1 ? 's' : ''}</strong> detected (&gt;30% deviation from median of {median.toFixed(1)}%)
                        </p>
                      </div>
                      <button
                        onClick={() => setShowOutliers(!showOutliers)}
                        className="text-[10px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        {showOutliers ? 'Hide' : 'Show'} markers
                      </button>
                    </div>
                  )}

                  {/* Excluded teams notice */}
                  {excludedTeams.size > 0 && (
                    <div className="flex items-center justify-between rounded-xl border border-white/6 bg-white/2 px-5 py-3">
                      <p className="text-xs text-white/40">
                        {excludedTeams.size} team{excludedTeams.size !== 1 ? 's' : ''} excluded from median calculation
                      </p>
                      <button
                        onClick={() => setExcludedTeams(new Set())}
                        className="text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-white/60 transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  )}

                  <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                    {/* Header row */}
                    <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/20">
                      <span className="w-10">#</span>
                      <span className="flex-1">Team</span>
                      <span className="w-24 text-center">Judges</span>
                      <span className="w-24 text-right">Score</span>
                      <span className="w-12" />
                    </div>
                    {leaderboard.map((entry, i) => {
                      const { isOutlier, deviation } = getOutlierInfo(entry.score, median);
                      const isExcluded = excludedTeams.has(entry.team_id);

                      return (
                        <motion.div
                          key={entry.team_id}
                          variants={item}
                          className={`flex items-center gap-4 rounded-2xl border p-5 transition-all duration-300 hover:bg-white/4 ${
                            isExcluded
                              ? 'border-white/4 bg-white/1 opacity-50'
                              : isOutlier && showOutliers
                                ? 'border-amber-500/30 bg-amber-500/5'
                                : i === 0
                                  ? 'border-[#CCFF00]/20 bg-[#CCFF00]/4'
                                  : i === 1
                                    ? 'border-white/8 bg-white/3'
                                    : 'border-white/ bg-white/2'
                          }`}
                        >
                          <span className={`w-10 text-2xl font-black ${
                            isExcluded ? 'text-white/10' : i === 0 ? 'text-[#CCFF00]' : i === 1 ? 'text-white/60' : i === 2 ? 'text-amber-600' : 'text-white/20'
                          }`}>
                            {entry.rank}
                          </span>
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <p className={`text-sm font-bold truncate ${isExcluded ? 'text-white/30 line-through' : 'text-white/80'}`}>{entry.team_name}</p>
                            {isOutlier && showOutliers && !isExcluded && (
                              <span className="group relative">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-[10px] text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                  {deviation > 0 ? '+' : ''}{deviation}% from median ({median.toFixed(1)}%)
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="w-24 text-center">
                            <span className="text-xs text-white/30">
                              {entry.judges_completed}/{entry.total_judges}
                            </span>
                          </div>
                          <div className="w-24 text-right">
                            <span className={`text-lg font-black tabular-nums ${
                              isExcluded ? 'text-white/20' : i === 0 ? 'text-[#CCFF00]' : 'text-white/70'
                            }`}>
                              {entry.score.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-12 flex justify-end">
                            {isOutlier && showOutliers && (
                              <button
                                onClick={() => {
                                  const next = new Set(excludedTeams);
                                  if (isExcluded) next.delete(entry.team_id);
                                  else next.add(entry.team_id);
                                  setExcludedTeams(next);
                                }}
                                className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${
                                  isExcluded ? 'text-emerald-400 hover:text-emerald-300' : 'text-white/20 hover:text-amber-400'
                                }`}
                                title={isExcluded ? 'Include in calculation' : 'Exclude from calculation'}
                              >
                                {isExcluded ? 'Include' : 'Exclude'}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </div>
              );
            })()
          )}

          {/* Judges */}
          {activeTab === 'judges' && (
            judges.length === 0 ? (
              <EmptyState
                icon={Scale}
                title="No judges assigned"
                description="Invite judges to start the evaluation process."
              />
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {judges.map((judge) => (
                  <motion.div
                    key={judge.id}
                    variants={item}
                    className="flex items-center gap-4 rounded-2xl border border-white/ bg-white/2 p-4 transition hover:border-white/12 hover:bg-white/4"
                  >
                    {judge.image ? (
                      <img src={judge.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-sm font-bold text-violet-400">
                        {judge.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/70 truncate">{judge.display_name}</p>
                      <p className="text-xs text-white/25 truncate">{judge.email}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      judge.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' :
                      judge.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-white/6 text-white/40'
                    }`}>
                      {judge.status}
                    </span>
                    {judge.status === 'pending' && (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => acceptJudgeInvite(judge.id)}
                        className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Accept
                      </motion.button>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )
          )}

          {/* Rubric */}
          {activeTab === 'rubric' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <Dialog open={rubricDialogOpen} onOpenChange={setRubricDialogOpen}>
                  <DialogTrigger asChild>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-2 rounded-full bg-[#CCFF00] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white"
                    >
                      <Plus className="h-4 w-4" />
                      Add Criterion
                    </motion.button>
                  </DialogTrigger>
                  <DialogContent className="border-white/8 bg-black/95 backdrop-blur-xl sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-white text-xl font-black">Add Rubric Criterion</DialogTitle>
                      <DialogDescription className="text-white/35">
                        Define a scoring criterion that judges will use to evaluate submissions.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-xs font-medium text-white/40 mb-1.5 block">Name *</label>
                        <Input
                          value={newCriterion.name}
                          onChange={(e) => setNewCriterion(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Innovation, Technical Complexity"
                          className="border-white/8 bg-white/3 text-white placeholder:text-white/20"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-white/40 mb-1.5 block">Description</label>
                        <Input
                          value={newCriterion.description}
                          onChange={(e) => setNewCriterion(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="What should judges look for?"
                          className="border-white/8 bg-white/3 text-white placeholder:text-white/20"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-white/40 mb-1.5 block">Max Score</label>
                          <Input
                            type="number"
                            min="1"
                            value={newCriterion.max_score}
                            onChange={(e) => setNewCriterion(prev => ({ ...prev, max_score: e.target.value }))}
                            className="border-white/8 bg-white/3 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-white/40 mb-1.5 block">Weight</label>
                          <Input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={newCriterion.weight}
                            onChange={(e) => setNewCriterion(prev => ({ ...prev, weight: e.target.value }))}
                            className="border-white/8 bg-white/3 text-white"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRubricDialogOpen(false)} className="border-white/10 bg-transparent text-white/60 hover:bg-white/6 hover:text-white">Cancel</Button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={createCriterion}
                        disabled={isCreatingCriterion}
                        className="rounded-lg bg-[#CCFF00] px-5 py-2 text-sm font-bold text-black transition hover:bg-white disabled:opacity-50"
                      >
                        {isCreatingCriterion ? 'Adding...' : 'Add Criterion'}
                      </motion.button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              {rubric.length === 0 ? (
                <EmptyState
                  icon={Star}
                  title="No rubric criteria"
                  description="Define scoring criteria for judges to evaluate submissions."
                />
              ) : (
                <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                  {rubric.sort((a, b) => a.sort_order - b.sort_order).map((criterion) => (
                    <motion.div
                      key={criterion.id}
                      variants={item}
                      className="flex items-center gap-4 rounded-2xl border border-white/ bg-white/2 p-5 transition hover:border-white/12 hover:bg-white/4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#CCFF00]/10 text-[#CCFF00] text-sm font-black">
                        {criterion.sort_order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white/80">{criterion.name}</p>
                        <p className="text-xs text-white/30 mt-0.5">{criterion.description}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <div>
                          <p className="text-xs text-white/25">Max</p>
                          <p className="text-sm font-bold text-white/60">{criterion.max_score}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/25">Weight</p>
                          <p className="text-sm font-bold text-[#CCFF00]">{criterion.weight}x</p>
                        </div>
                        <button
                          onClick={() => deleteCriterion(criterion.id)}
                          className="ml-2 rounded-lg p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 transition"
                          title="Delete criterion"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </>
          )}

          {/* Scoring Tab (judges only) */}
          {activeTab === 'scoring' && isJudge && (
            <div className="space-y-6">
              {!selectedAssignment ? (
                <>
                  {/* Pending assignments */}
                  <div>
                    <h2 className="text-lg font-bold text-white/80 mb-4 flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-[#CCFF00]" />
                      Pending Assignments ({pendingAssignments.length})
                    </h2>
                    {pendingAssignments.length === 0 ? (
                      <EmptyState
                        icon={ClipboardCheck}
                        title="No pending assignments"
                        description="You'll see submissions here once an organizer assigns them to you."
                      />
                    ) : (
                      <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                        {pendingAssignments.map((assignment) => (
                          <motion.div
                            key={assignment.id}
                            variants={item}
                            className="flex items-center gap-4 rounded-2xl border border-white/ bg-white/2 p-5 transition hover:border-[#CCFF00]/20 hover:bg-white/4"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white/80">{assignment.team_name}</p>
                              <p className="text-xs text-white/30 mt-0.5">
                                Tag: <span className="font-mono text-white/50">{assignment.tag_name || 'N/A'}</span>
                                {assignment.commit_sha && (
                                  <> &bull; Commit: <span className="font-mono text-white/50">{assignment.commit_sha.slice(0, 7)}</span></>
                                )}
                              </p>
                            </div>
                            <Badge className="bg-amber-500/20 text-amber-400 border-0">pending</Badge>
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => selectAssignmentForScoring(assignment)}
                              className="flex items-center gap-2 rounded-full bg-[#CCFF00] px-4 py-2 text-sm font-bold text-black transition hover:bg-white"
                            >
                              Score <ArrowRight className="h-4 w-4" />
                            </motion.button>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </div>

                  {/* Scored assignments */}
                  {scoredAssignments.length > 0 && (
                    <div>
                      <h2 className="text-lg font-bold text-white/80 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        Completed ({scoredAssignments.length})
                      </h2>
                      <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                        {scoredAssignments.map((assignment) => (
                          <motion.div
                            key={assignment.id}
                            variants={item}
                            className="flex items-center gap-4 rounded-2xl border border-white/ bg-white/2 p-4 transition"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white/60">{assignment.team_name}</p>
                              <p className="text-xs text-white/20 mt-0.5">
                                Tag: <span className="font-mono">{assignment.tag_name || 'N/A'}</span>
                              </p>
                            </div>
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-0">scored</Badge>
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => selectAssignmentForScoring(assignment)}
                              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
                            >
                              Re-score
                            </motion.button>
                          </motion.div>
                        ))}
                      </motion.div>
                    </div>
                  )}
                </>
              ) : (
                /* Inline scoring form for selected assignment */
                <div className="space-y-6">
                  <button
                    onClick={() => { setSelectedAssignment(null); setScoreInputs({}); }}
                    className="flex items-center text-sm text-white/40 hover:text-white transition"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Assignments
                  </button>

                  <div className="rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/4 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-black text-white">Scoring: {selectedAssignment.team_name}</p>
                        <p className="text-xs text-white/40 mt-1">
                          Tag: <span className="font-mono text-white/60">{selectedAssignment.tag_name || 'N/A'}</span>
                          {selectedAssignment.commit_sha && (
                            <> &bull; Commit: <span className="font-mono text-white/60">{selectedAssignment.commit_sha.slice(0, 7)}</span></>
                          )}
                        </p>
                      </div>
                      <Badge className="bg-[#CCFF00]/20 text-[#CCFF00] border-0">Judge Mode</Badge>
                    </div>
                  </div>

                  {rubric.length === 0 ? (
                    <EmptyState
                      icon={AlertCircle}
                      title="No rubric criteria"
                      description="No rubric criteria have been defined yet. Add criteria in the Rubric tab."
                    />
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2 space-y-4">
                        {rubric.sort((a, b) => a.sort_order - b.sort_order).map((criterion) => (
                          <div key={criterion.id} className="rounded-2xl border border-white/ bg-white/2 p-6 space-y-4">
                            <div className="flex justify-between items-start gap-4">
                              <div>
                                <h3 className="text-sm font-bold text-white/80">{criterion.name}</h3>
                                <p className="text-xs text-white/30 mt-1">{criterion.description}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-white/6 px-2.5 py-0.5 text-[10px] font-bold text-white/40">
                                Max: {criterion.max_score}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="md:col-span-1">
                                <label className="text-[10px] font-medium text-white/25 mb-1.5 block">
                                  Score (0-{criterion.max_score})
                                </label>
                                <Input
                                  type="number"
                                  min="0"
                                  max={criterion.max_score}
                                  value={scoreInputs[criterion.id]?.score || ''}
                                  onChange={(e) => handleScoreInputChange(criterion.id, e.target.value)}
                                  className="border-white/8 bg-white/3 text-white text-center font-bold text-lg h-12"
                                />
                              </div>
                              <div className="md:col-span-3">
                                <label className="text-[10px] font-medium text-white/25 mb-1.5 block">
                                  Comments (Optional)
                                </label>
                                <textarea
                                  value={scoreInputs[criterion.id]?.comment || ''}
                                  onChange={(e) => handleCommentInputChange(criterion.id, e.target.value)}
                                  className="flex min-h-[48px] w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-white placeholder:text-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CCFF00]/30 resize-none"
                                  placeholder="Add feedback..."
                                  rows={2}
                                />
                              </div>
                            </div>
                          </div>
                        ))}

                        <div className="flex justify-end pt-4">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={submitScores}
                            disabled={isSubmittingScores || rubric.length === 0}
                            className="flex items-center gap-2 rounded-full bg-[#CCFF00] px-8 py-3 text-sm font-bold text-black transition hover:bg-white disabled:opacity-50"
                          >
                            {isSubmittingScores ? (
                              <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                            ) : (
                              <><Send className="h-4 w-4" /> Submit Scores</>
                            )}
                          </motion.button>
                        </div>
                      </div>

                      {/* Scoring sidebar / guide */}
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/ bg-white/2 p-5 sticky top-6">
                          <h4 className="text-sm font-bold text-white/60 mb-4">Scoring Guide</h4>
                          <div className="space-y-3 text-xs text-white/30">
                            <div className="flex gap-3">
                              <AlertCircle className="h-4 w-4 text-[#CCFF00] shrink-0 mt-0.5" />
                              <div>
                                <p className="text-white/50 font-medium mb-0.5">Independent Scoring</p>
                                <p>Each criterion is scored independently. All criteria should be scored.</p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <CheckCircle2 className="h-4 w-4 text-[#CCFF00] shrink-0 mt-0.5" />
                              <div>
                                <p className="text-white/50 font-medium mb-0.5">Updatable</p>
                                <p>Scores can be updated by re-scoring the same submission.</p>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-white/8">
                            <h5 className="text-xs font-bold text-white/40 mb-2">Rubric Summary</h5>
                            <ul className="space-y-1.5">
                              {rubric.map((c) => (
                                <li key={c.id} className="flex justify-between text-xs text-white/30">
                                  <span className="truncate mr-2">{c.name}</span>
                                  <span className="text-[#CCFF00] font-bold">{c.weight}x</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Conflicts Tab */}
          {activeTab === 'progress' && (
            <ScoringProgressPanel judges={judges} slug={slug!} />
          )}

          {activeTab === 'conflicts' && (
            <ConflictsPanel
              conflicts={conflicts}
              judges={judges}
              slug={slug!}
              onRefresh={fetchData}
            />
          )}
        </>
      )}
    </div>
  );
}
