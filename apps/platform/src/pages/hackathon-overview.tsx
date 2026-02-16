import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { StatusBadge, MetricCard, PageHeader, CountdownTimer } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  FileCode,
  Scale,
  Clock,
  GitBranch,
  ArrowRight,
  Globe,
  Zap,
  Trophy,
  Calendar,
  ChevronRight,
  Activity,
} from 'lucide-react';

interface Hackathon {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  starts_at: string | null;
  submission_deadline: string | null;
  judging_starts: string | null;
  judging_ends: string | null;
  max_team_size: number;
  created_at: string;
  updated_at: string;
}

const NEXT_STATUS: Record<string, string> = {
  draft: 'active',
  active: 'judging',
  judging: 'completed',
  completed: 'archived',
};

const NEXT_PHASE_LABEL: Record<string, string> = {
  draft: 'Activate',
  active: 'Start Judging',
  judging: 'Complete',
  completed: 'Archive',
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export function HackathonOverviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetchHackathon();
  }, [slug]);

  const fetchHackathon = async () => {
    try {
      const res = await apiRequest<{ data: Hackathon }>(`/api/v1/hackathons/${slug}`);
      setHackathon(res.data);
    } catch (_err) {
      toast.error('Failed to load hackathon');
    } finally {
      setLoading(false);
    }
  };

  const advancePhase = async () => {
    if (!hackathon || !slug) return;
    const nextStatus = NEXT_STATUS[hackathon.status];
    if (!nextStatus) return;
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ targetStatus: nextStatus }),
      });
      toast.success(`Phase advanced to ${nextStatus.replace(/_/g, ' ')}`);
      fetchHackathon();
    } catch (_err) {
      toast.error('Failed to advance phase');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-white/[0.06]" />
        <Skeleton className="h-4 w-80 bg-white/[0.06]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`s-${String(i)}`} className="h-32 bg-white/[0.06] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!hackathon) {
    return <div className="text-white/40 text-center py-20">Hackathon not found</div>;
  }

  const quickLinks = [
    { label: 'Teams', icon: Users, path: `/hackathons/${slug}/teams`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Submissions', icon: FileCode, path: `/hackathons/${slug}/submissions`, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Judging', icon: Scale, path: `/hackathons/${slug}/judging`, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Activity', icon: Activity, path: `/hackathons/${slug}/activity`, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  // State machine visualization
  const phases = ['draft', 'active', 'judging', 'completed', 'archived'];
  const currentIdx = phases.indexOf(hackathon.status);

  return (
    <div>
      <PageHeader
        title={hackathon.title}
        description={hackathon.description || 'No description provided'}
        badge={<StatusBadge status={hackathon.status} pulse={hackathon.status === 'active'} />}
        actions={
          NEXT_PHASE_LABEL[hackathon.status] ? (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={advancePhase}
              className="flex items-center gap-2 rounded-full bg-[#CCFF00] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white"
            >
              {NEXT_PHASE_LABEL[hackathon.status]}
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          ) : undefined
        }
      />

      {/* State machine progress bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 mb-4">Lifecycle Progress</p>
        <div className="flex items-center gap-1">
          {phases.map((phase, i) => {
            const isCompleted = i < currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <div key={phase} className="flex items-center flex-1">
                <div className="flex-1 relative">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      isCompleted
                        ? 'bg-[#CCFF00]'
                        : isCurrent
                          ? 'bg-[#CCFF00]/40'
                          : 'bg-white/[0.06]'
                    }`}
                  />
                  {isCurrent && (
                    <motion.div
                      className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[#CCFF00] border-2 border-black"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>
                {i < phases.length - 1 && <div className="w-1" />}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          {phases.map((phase, i) => (
            <span
              key={phase}
              className={`text-[8px] font-medium uppercase tracking-wider ${
                i <= currentIdx ? 'text-[#CCFF00]/60' : 'text-white/15'
              }`}
            >
              {phase.replace(/_/g, ' ').slice(0, 6)}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Metrics row */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div variants={item}>
          <MetricCard label="Teams" value={0} icon={Users} />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard label="Submissions" value={0} icon={FileCode} />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard label="Judges" value={0} icon={Scale} />
        </motion.div>
        <motion.div variants={item}>
          <CountdownTimer
            targetDate={hackathon.submission_deadline}
            label="Deadline"
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
          />
        </motion.div>
      </motion.div>

      {/* Quick links grid */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white/70 mb-4">Quick Access</h2>
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <motion.div key={link.label} variants={item}>
                <Link
                  to={link.path}
                  className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${link.bg} ${link.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">{link.label}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/15 group-hover:text-white/40 transition-colors" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Info cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* Timeline card */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h3 className="text-sm font-bold text-white/60 mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#CCFF00]/50" />
            Timeline
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Starts At', date: hackathon.starts_at, icon: Globe },
              { label: 'Submission Deadline', date: hackathon.submission_deadline, icon: GitBranch },
              { label: 'Judging Starts', date: hackathon.judging_starts, icon: Clock },
            ].filter((event) => event.date != null).map((event) => {
              const EventIcon = event.icon;
              const isPast = new Date(event.date!) < new Date();
              return (
                <div key={event.label} className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isPast ? 'bg-[#CCFF00]/10 text-[#CCFF00]' : 'bg-white/[0.04] text-white/25'}`}>
                    <EventIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isPast ? 'text-white/60' : 'text-white/40'}`}>{event.label}</p>
                    <p className="text-xs text-white/25">
                      {new Date(event.date!).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {isPast && <span className="text-[10px] font-semibold text-[#CCFF00] uppercase">Done</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Config card */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h3 className="text-sm font-bold text-white/60 mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#CCFF00]/50" />
            Configuration
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Max Team Size', value: String(hackathon.max_team_size) },
              { label: 'Slug', value: hackathon.slug },
              { label: 'Created', value: new Date(hackathon.created_at).toLocaleDateString() },
              { label: 'Last Updated', value: new Date(hackathon.updated_at).toLocaleDateString() },
            ].map((detail) => (
              <div key={detail.label} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                <span className="text-sm text-white/35">{detail.label}</span>
                <span className="text-sm font-medium text-white/70">{detail.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
