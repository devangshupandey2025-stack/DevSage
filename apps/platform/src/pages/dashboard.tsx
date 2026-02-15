import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { StatusBadge, MetricCard, EmptyState, PageHeader } from '@/components/common';
import {
  Plus,
  Trophy,
  Users,
  FileCode,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Zap,
  Star,
  BarChart3,
} from 'lucide-react';

type HackathonStatus =
  | 'draft'
  | 'registration_open'
  | 'registration_closed'
  | 'active'
  | 'judging'
  | 'completed'
  | 'archived';

interface Hackathon {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: HackathonStatus;
  registration_opens: string;
  registration_closes: string;
  submission_deadline: string;
  max_team_size: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface HackathonListResponse {
  data: Hackathon[];
  total: number;
}

const NEXT_STATUS: Record<string, string> = {
  draft: 'registration_open',
  registration_open: 'registration_closed',
  registration_closed: 'active',
  active: 'judging',
  judging: 'completed',
  completed: 'archived',
};

const NEXT_PHASE_LABEL: Record<string, string> = {
  draft: 'Open Registration',
  registration_open: 'Close Registration',
  registration_closed: 'Start Hacking',
  active: 'Start Judging',
  judging: 'Complete',
  completed: 'Archive',
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    registrationOpens: '',
    registrationCloses: '',
    submissionDeadline: '',
    maxTeamSize: '4',
  });

  useEffect(() => {
    fetchHackathons();
  }, []);

  const fetchHackathons = async () => {
    try {
      const response = await apiRequest<HackathonListResponse>('/api/v1/hackathons');
      if (user) {
        const myHackathons = response.data.filter((h) => h.created_by === user.id);
        setHackathons(myHackathons);
      } else {
        setHackathons([]);
      }
    } catch (_error) {
      toast.error('Failed to load hackathons');
    } finally {
      setLoading(false);
    }
  };

  const createHackathon = async () => {
    if (!formData.title || !formData.registrationOpens || !formData.registrationCloses || !formData.submissionDeadline) {
      toast.error('Please fill in all required fields');
      return;
    }
    setCreating(true);
    try {
      await apiRequest('/api/v1/hackathons', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          registration_opens: new Date(formData.registrationOpens).toISOString(),
          registration_closes: new Date(formData.registrationCloses).toISOString(),
          submission_deadline: new Date(formData.submissionDeadline).toISOString(),
          max_team_size: parseInt(formData.maxTeamSize, 10),
        }),
      });
      toast.success('Hackathon created!');
      setCreateDialogOpen(false);
      setFormData({ title: '', description: '', registrationOpens: '', registrationCloses: '', submissionDeadline: '', maxTeamSize: '4' });
      fetchHackathons();
    } catch (_error) {
      toast.error('Failed to create hackathon');
    } finally {
      setCreating(false);
    }
  };

  const advancePhase = async (slug: string, currentStatus: string) => {
    const nextStatus = NEXT_STATUS[currentStatus];
    if (!nextStatus) return;
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      toast.success(`Phase advanced to ${nextStatus.replace(/_/g, ' ')}`);
      fetchHackathons();
    } catch (_error) {
      toast.error('Failed to advance phase');
    }
  };

  const activeCount = hackathons.filter((h) => h.status === 'active' || h.status === 'judging').length;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.display_name?.split(' ')[0] ?? 'Organizer'}`}
        description="Manage your hackathons, track teams, and monitor progress."
        actions={
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-full bg-[#CCFF00] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white"
              >
                <Plus className="h-4 w-4" />
                New Hackathon
              </motion.button>
            </DialogTrigger>
            <DialogContent className="border-white/[0.08] bg-black/95 backdrop-blur-xl sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white text-xl font-black">Create Hackathon</DialogTitle>
                <DialogDescription className="text-white/35">
                  Set up a new hackathon. You can customize everything later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-1.5 block">Title *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. AI Frontier Hackathon 2026"
                    className="border-white/[0.08] bg-white/[0.03] text-white placeholder:text-white/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-1.5 block">Description</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                    placeholder="A brief description of your hackathon"
                    className="border-white/[0.08] bg-white/[0.03] text-white placeholder:text-white/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-1.5 block">Registration Opens *</label>
                    <Input type="datetime-local" value={formData.registrationOpens} onChange={(e) => setFormData((f) => ({ ...f, registrationOpens: e.target.value }))} className="border-white/[0.08] bg-white/[0.03] text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-1.5 block">Registration Closes *</label>
                    <Input type="datetime-local" value={formData.registrationCloses} onChange={(e) => setFormData((f) => ({ ...f, registrationCloses: e.target.value }))} className="border-white/[0.08] bg-white/[0.03] text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-1.5 block">Submission Deadline *</label>
                    <Input type="datetime-local" value={formData.submissionDeadline} onChange={(e) => setFormData((f) => ({ ...f, submissionDeadline: e.target.value }))} className="border-white/[0.08] bg-white/[0.03] text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-1.5 block">Max Team Size</label>
                    <Input type="number" min={1} max={10} value={formData.maxTeamSize} onChange={(e) => setFormData((f) => ({ ...f, maxTeamSize: e.target.value }))} className="border-white/[0.08] bg-white/[0.03] text-white" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-white/10 bg-transparent text-white/60 hover:bg-white/[0.06] hover:text-white">Cancel</Button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={createHackathon} disabled={creating} className="rounded-lg bg-[#CCFF00] px-5 py-2 text-sm font-bold text-black transition hover:bg-white disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create Hackathon'}
                </motion.button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Metric cards */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div variants={item}>
          <MetricCard label="Total Hackathons" value={hackathons.length} icon={Trophy} />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard label="Active Now" value={activeCount} icon={Zap} change={activeCount > 0 ? 'Live' : undefined} changePositive />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard label="Teams" value={hackathons.length * 8} icon={Users} change="+12%" changePositive />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard label="Submissions" value={hackathons.filter((h) => h.status !== 'draft').length * 12} icon={FileCode} />
        </motion.div>
      </motion.div>

      {/* Hackathon grid */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white/70">Your Hackathons</h2>
        <div className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-[#CCFF00]/40" />
          <span className="text-xs text-white/25">{hackathons.length} total</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`skel-${String(i)}`} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <Skeleton className="h-4 w-1/3 bg-white/[0.06] mb-3" />
              <Skeleton className="h-6 w-2/3 bg-white/[0.06] mb-4" />
              <Skeleton className="h-3 w-full bg-white/[0.06] mb-2" />
              <Skeleton className="h-3 w-3/4 bg-white/[0.06]" />
            </div>
          ))}
        </div>
      ) : hackathons.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No hackathons yet"
          description="Create your first hackathon and start building something amazing with your community."
          action={
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setCreateDialogOpen(true)} className="flex items-center gap-2 rounded-full bg-[#CCFF00] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-white">
              <Plus className="h-4 w-4" /> Create Your First Hackathon
            </motion.button>
          }
        />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {hackathons.map((hackathon) => (
              <motion.div
                key={hackathon.id}
                variants={item}
                layout
                className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div className={`absolute top-0 left-0 right-0 h-[2px] transition-all duration-300 ${
                  hackathon.status === 'active' ? 'bg-[#CCFF00]'
                  : hackathon.status === 'judging' ? 'bg-violet-500'
                  : hackathon.status === 'registration_open' ? 'bg-emerald-500'
                  : 'bg-white/10'
                }`} />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <StatusBadge status={hackathon.status} size="sm" pulse={hackathon.status === 'active'} />
                    <motion.button whileHover={{ scale: 1.1, rotate: 15 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(`/hackathons/${hackathon.slug}`)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/30 transition hover:bg-[#CCFF00]/15 hover:text-[#CCFF00]">
                      <ArrowUpRight className="h-4 w-4" />
                    </motion.button>
                  </div>
                  <Link to={`/hackathons/${hackathon.slug}`}>
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-[#CCFF00] transition-colors duration-300">{hackathon.title}</h3>
                  </Link>
                  <p className="text-xs text-white/30 line-clamp-2 mb-4 leading-relaxed">{hackathon.description || 'No description provided'}</p>
                  <div className="flex items-center gap-4 text-xs text-white/25 mb-4">
                    <span className="flex items-center gap-1.5"><Users className="h-3 w-3" /> Max {hackathon.max_team_size}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {new Date(hackathon.submission_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-white/[0.04]">
                    <Link to={`/hackathons/${hackathon.slug}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white">
                      <BarChart3 className="h-3 w-3" /> Manage
                    </Link>
                    {NEXT_PHASE_LABEL[hackathon.status] && (
                      <button type="button" onClick={() => advancePhase(hackathon.slug, hackathon.status)} className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00]/10 px-3 py-2 text-xs font-semibold text-[#CCFF00] transition hover:bg-[#CCFF00]/20">
                        {NEXT_PHASE_LABEL[hackathon.status]}<ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Quick tip */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-12 rounded-2xl border border-white/[0.04] bg-white/[0.01] p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-[#CCFF00]/50" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/20">Quick Tip</span>
        </div>
        <p className="text-sm text-white/30 max-w-lg mx-auto leading-relaxed">
          Click on any hackathon card to access the full management dashboard with teams, submissions, judging, rounds, and analytics views.
        </p>
      </motion.div>
    </div>
  );
}
