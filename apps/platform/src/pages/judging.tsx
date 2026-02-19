import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { PageHeader, EmptyState } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  CheckCircle,
  Clock,
  ArrowUpDown,
  Plus,
  Shuffle,
  Trash2,
  Loader2,
} from 'lucide-react';

interface Judge {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
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

interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  max_score: number;
  weight: number;
  sort_order: number;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export function JudgingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'judges' | 'rubric'>('leaderboard');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [rubricDialogOpen, setRubricDialogOpen] = useState(false);
  const [newCriterion, setNewCriterion] = useState({ name: '', description: '', max_score: '10', weight: '1' });
  const [isCreatingCriterion, setIsCreatingCriterion] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    try {
      const [judgesRes, leaderboardRes, rubricRes] = await Promise.allSettled([
        apiRequest<{ data: Judge[] }>(`/api/v1/hackathons/${slug}/judging/judges`),
        apiRequest<{ data: LeaderboardEntry[] }>(`/api/v1/hackathons/${slug}/judging/leaderboard`),
        apiRequest<{ data: RubricCriterion[] }>(`/api/v1/hackathons/${slug}/judging/rubric`),
      ]);
      if (judgesRes.status === 'fulfilled') setJudges(judgesRes.value.data ?? []);
      if (leaderboardRes.status === 'fulfilled') setLeaderboard(leaderboardRes.value.data ?? []);
      if (rubricRes.status === 'fulfilled') setRubric(rubricRes.value.data ?? []);
    } catch (_err) {
      // graceful
    } finally {
      setLoading(false);
    }
  };

  const inviteJudge = async () => {
    if (!inviteUserId.trim()) return;
    try {
      const res = await apiRequest<{ data: { already_invited?: boolean; message?: string } }>(`/api/v1/hackathons/${slug}/judging/judges`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteUserId }),
      });
      if (res.data?.already_invited) {
        toast.info(res.data.message ?? 'Judge already invited — invite email re-sent.');
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
      toast.success(`Submissions assigned to judges (round-robin)!`);
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign submissions';
      toast.error(message);
    } finally {
      setIsAssigning(false);
    }
  };

  const tabs = [
    { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { key: 'judges', label: 'Judges', icon: Users },
    { key: 'rubric', label: 'Rubric', icon: Star },
  ] as const;

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
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                {/* Header row */}
                <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/20">
                  <span className="w-10">#</span>
                  <span className="flex-1">Team</span>
                  <span className="w-24 text-center">Judges</span>
                  <span className="w-24 text-right">Score</span>
                </div>
                {leaderboard.map((entry, i) => (
                  <motion.div
                    key={entry.team_id}
                    variants={item}
                    className={`flex items-center gap-4 rounded-2xl border p-5 transition-all duration-300 hover:bg-white/4 ${
                      i === 0
                        ? 'border-[#CCFF00]/20 bg-[#CCFF00]/4'
                        : i === 1
                          ? 'border-white/8 bg-white/3'
                          : 'border-white/ bg-white/2'
                    }`}
                  >
                    <span className={`w-10 text-2xl font-black ${
                      i === 0 ? 'text-[#CCFF00]' : i === 1 ? 'text-white/60' : i === 2 ? 'text-amber-600' : 'text-white/20'
                    }`}>
                      {entry.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white/80 truncate">{entry.team_name}</p>
                    </div>
                    <div className="w-24 text-center">
                      <span className="text-xs text-white/30">
                        {entry.judges_completed}/{entry.total_judges}
                      </span>
                    </div>
                    <div className="w-24 text-right">
                      <span className={`text-lg font-black tabular-nums ${i === 0 ? 'text-[#CCFF00]' : 'text-white/70'}`}>
                        {entry.score.toFixed(1)}%
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )
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
                    {judge.avatar_url ? (
                      <img src={judge.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
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
        </>
      )}
    </div>
  );
}
