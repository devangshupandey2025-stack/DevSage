import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { StatusBadge, PageHeader, CountdownTimer } from '@/components/common';
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
  CheckCircle2,
  Circle,
  Loader2,
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
  draft: 'Launch Hackathon',
  active: 'Begin Judging',
  judging: 'Finalize Event',
  completed: 'Archive',
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

interface OverviewMetrics {
  teams: number;
  submissions: number;
  judges: number;
}

export function HackathonOverviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [metrics, setMetrics] = useState<OverviewMetrics>({ teams: 0, submissions: 0, judges: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetchHackathon();
    fetchMetrics();
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

  const fetchMetrics = async () => {
    if (!slug) return;
    try {
      const [teamsRes, submissionsRes, judgesRes] = await Promise.all([
        apiRequest<{ ok: boolean; data: unknown[] }>(`/api/v1/hackathons/${slug}/teams`),
        apiRequest<{ ok: boolean; data: unknown[] }>(`/api/v1/hackathons/${slug}/submissions`),
        apiRequest<{ ok: boolean; data: unknown[] }>(`/api/v1/hackathons/${slug}/judges`),
      ]);
      setMetrics({
        teams: teamsRes.data?.length ?? 0,
        submissions: submissionsRes.data?.length ?? 0,
        judges: judgesRes.data?.length ?? 0,
      });
    } catch (_err) {
      // Silently fail
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
      <div className="space-y-8 p-1">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64 bg-white/[0.04]" />
          <Skeleton className="h-5 w-96 bg-white/[0.04]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 bg-white/[0.04] rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-white/[0.05] flex items-center justify-center mb-4">
          <Trophy className="w-8 h-8 text-white/20" />
        </div>
        <h3 className="text-xl font-semibold text-white/80 mb-1">Hackathon Not Found</h3>
        <p className="text-white/40 text-sm">The requested event does not exist or was deleted.</p>
      </div>
    );
  }

  const quickLinks = [
    { label: 'Teams', icon: Users, path: `/hackathons/${slug}/teams`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', stat: metrics.teams, statLabel: 'Total' },
    { label: 'Submissions', icon: FileCode, path: `/hackathons/${slug}/submissions`, color: 'text-sky-400', bg: 'bg-sky-500/10', stat: metrics.submissions, statLabel: 'Projects' },
    { label: 'Judging', icon: Scale, path: `/hackathons/${slug}/judging`, color: 'text-violet-400', bg: 'bg-violet-500/10', stat: metrics.judges, statLabel: 'Judges' },
    { label: 'Activity', icon: Activity, path: `/hackathons/${slug}/activity`, color: 'text-amber-400', bg: 'bg-amber-500/10', stat: null, statLabel: '' },
  ];

  const phases = ['draft', 'active', 'judging', 'completed', 'archived'];
  const currentIdx = phases.indexOf(hackathon.status);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="space-y-10 max-w-7xl mx-auto"
    >
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/[0.05] pb-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status={hackathon.status} pulse={hackathon.status === 'active'} />
            <span className="text-xs font-mono text-white/30 uppercase tracking-widest">
              ID: {hackathon.slug}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {hackathon.title}
          </h1>
          <p className="text-white/50 mt-2 text-base max-w-2xl">
            {hackathon.description || 'No description provided for this event.'}
          </p>
        </div>

        {NEXT_PHASE_LABEL[hackathon.status] && (
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(204, 255, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
            onClick={advancePhase}
            className="flex items-center gap-3 rounded-full bg-[#CCFF00] px-6 py-3 text-sm font-bold text-black transition hover:bg-[#b8e600] shadow-[0_0_15px_rgba(204,255,0,0.15)]"
          >
            {NEXT_PHASE_LABEL[hackathon.status]}
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>

      {/* Lifecycle Stepper */}
      <motion.div 
        variants={container} 
        initial="hidden" 
        animate="show"
        className="relative p-6 rounded-2xl border border-white/[0.06] bg-[#0A0A0A]"
      >
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-2xl pointer-events-none">
           <div className="absolute -top-1/2 -right-1/2 w-[500px] h-[500px] bg-[#CCFF00]/[0.02] rounded-full blur-3xl" />
        </div>

        <div className="relative flex justify-between items-center">
          {phases.map((phase, i) => {
            const isCompleted = i < currentIdx;
            const isCurrent = i === currentIdx;
            const statusColor = isCompleted || isCurrent ? 'text-[#CCFF00]' : 'text-white/20';
            
            return (
              <motion.div key={phase} variants={item} className="flex-1 relative z-10">
                <div className="flex flex-col items-center relative">
                  {/* Connector Line */}
                  {i < phases.length - 1 && (
                    <div className="absolute top-[19px] left-1/2 w-full h-[2px]">
                      <div className={`h-full transition-colors duration-500 ${isCompleted ? 'bg-[#CCFF00]' : 'bg-white/[0.1]'}`} />
                    </div>
                  )}
                  
                  {/* Node */}
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-[#CCFF00] border-[#CCFF00] text-black' 
                      : isCurrent 
                        ? 'bg-black border-[#CCFF00] text-[#CCFF00] shadow-[0_0_12px_rgba(204,255,0,0.4)]' 
                        : 'bg-[#111] border-white/10 text-white/30'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isCurrent ? (
                      <div className="w-2 h-2 rounded-full bg-[#CCFF00]" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    )}
                  </div>
                  
                  <span className={`mt-3 text-xs font-semibold uppercase tracking-wider transition-colors ${statusColor}`}>
                    {phase}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Teams', value: metrics.teams, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Submissions', value: metrics.submissions, icon: FileCode, color: 'text-sky-400', bg: 'bg-sky-500/10' },
          { label: 'Judges Assigned', value: metrics.judges, icon: Scale, color: 'text-violet-400', bg: 'bg-violet-500/10' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            initial="hidden"
            animate="show"
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/[0.12]"
          >
            <div className={`absolute top-4 right-4 ${stat.bg} ${stat.color} p-2 rounded-lg opacity-50 group-hover:opacity-100 transition-opacity`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="mt-4">
              <span className="text-4xl font-bold text-white tracking-tight">
                {stat.value}
              </span>
              <p className="text-white/40 text-sm font-medium mt-1">{stat.label}</p>
            </div>
          </motion.div>
        ))}

        {/* Countdown Timer Card */}
        <motion.div
          variants={item}
          initial="hidden"
          animate="show"
          className="relative overflow-hidden rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.03] p-6 col-span-2 lg:col-span-1"
        >
          <div className="flex items-center gap-2 mb-2 text-[#CCFF00]">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">
              {hackathon.status === 'active' ? 'Submission Deadline' : 'Next Milestone'}
            </span>
          </div>
          {hackathon.submission_deadline ? (
            <CountdownTimer
              targetDate={hackathon.submission_deadline}
              label=""
              className="p-0 bg-transparent border-none"
            />
          ) : (
            <p className="text-white/40 text-sm italic">No deadline set</p>
          )}
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Access Section */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-4 h-4" /> Quick Access
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  to={link.path}
                  key={link.label}
                  className="group relative flex flex-col justify-between h-36 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.15] overflow-hidden"
                >
                  {/* Decorative Gradient */}
                  <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full ${link.bg} opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500`} />
                  
                  <div className="flex justify-between items-start">
                    <div className={`p-2.5 rounded-xl ${link.bg}`}>
                      <Icon className={`w-5 h-5 ${link.color}`} />
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-white/40 group-hover:translate-x-1 transition-all" />
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-white/80 group-hover:text-white transition-colors">
                      {link.label}
                    </h4>
                    {link.stat !== null && (
                      <p className="text-sm text-white/30">{link.stat} {link.statLabel}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Timeline & Config Section */}
        <div className="space-y-6">
           {/* Timeline */}
           <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h3 className="text-sm font-bold text-white/60 mb-6 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#CCFF00]/50" />
              Timeline
            </h3>
            <div className="relative border-l border-white/[0.1] ml-2 pl-6 space-y-6">
              {[
                { label: 'Starts At', date: hackathon.starts_at },
                { label: 'Submission Deadline', date: hackathon.submission_deadline },
                { label: 'Judging Starts', date: hackathon.judging_starts },
              ].filter((event) => event.date).map((event, idx) => {
                const isPast = new Date(event.date!) < new Date();
                return (
                  <div key={idx} className="relative">
                    {/* Dot */}
                    <div className={`absolute -left-[30px] top-1.5 w-3 h-3 rounded-full border-2 ${
                      isPast 
                        ? 'bg-[#CCFF00] border-black' 
                        : 'bg-[#111] border-white/20'
                    }`} />
                    
                    <p className="text-xs font-bold uppercase tracking-wider text-white/30 mb-1">
                      {event.label}
                    </p>
                    <p className="text-sm text-white/70 font-medium">
                      {new Date(event.date!).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                    {isPast && (
                      <span className="text-[10px] font-bold text-[#CCFF00] uppercase tracking-wider">Completed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h3 className="text-sm font-bold text-white/60 mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#CCFF00]/50" />
              Configuration
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Max Team Size', value: hackathon.max_team_size },
                { label: 'Created', value: new Date(hackathon.created_at).toLocaleDateString() },
              ].map((detail) => (
                <div key={detail.label} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                  <span className="text-xs font-medium text-white/30 uppercase tracking-wider">{detail.label}</span>
                  <span className="text-sm font-mono text-white/70">{detail.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
