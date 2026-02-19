import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { StatusBadge, PageHeader, CountdownTimer } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  FileCode,
  Scale,
  Clock,
  ArrowRight,
  Zap,
  Trophy,
  Calendar,
  ChevronRight,
  Activity,
  Settings2,
  Sparkles,
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
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
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
        apiRequest<{ ok: boolean; data: unknown[] }>(`/api/v1/hackathons/${slug}/judging/judges`),
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
      await apiRequest(`/api/v1/hackathons/${slug}/transition`, {
        method: 'POST',
        body: JSON.stringify({ target_status: nextStatus, version: -1 }),
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
        <div className="flex justify-between items-start">
          <div className="space-y-3">
            <Skeleton className="h-6 w-24 bg-white/4 rounded-full" />
            <Skeleton className="h-10 w-72 bg-white/4" />
            <Skeleton className="h-5 w-96 bg-white/4" />
          </div>
          <Skeleton className="h-12 w-40 bg-white/4 rounded-full" />
        </div>
        <Skeleton className="h-24 bg-white/4 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-32 bg-white/4 rounded-2xl" />
          <Skeleton className="h-32 bg-white/4 rounded-2xl" />
          <Skeleton className="h-32 bg-white/4 rounded-2xl" />
          <Skeleton className="h-32 bg-white/4 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-20 h-20 rounded-2xl bg-white/3 border border-white/ flex items-center justify-center mb-6">
          <Trophy className="w-8 h-8 text-white/20" />
        </div>
        <h3 className="text-xl font-semibold text-white/80 mb-2">Hackathon Not Found</h3>
        <p className="text-white/40 text-sm max-w-sm">The requested event does not exist or may have been removed.</p>
      </div>
    );
  }

  const quickLinks = [
    { label: 'Teams', icon: Users, path: `/hackathons/${slug}/teams`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', stat: metrics.teams, statLabel: 'Registered' },
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
      className="relative space-y-8"
    >
      {/* Background Ambient Light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-96 bg-[#CCFF00]/2 blur-[120px] pointer-events-none" />

      {/* Header Section */}
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={hackathon.status} pulse={hackathon.status === 'active'} />
            <div className="h-4 w-px bg-white/10" />
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
              {hackathon.slug}
            </span>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">
              {hackathon.title}
            </h1>
            <p className="text-white/40 mt-2 text-base max-w-xl leading-relaxed">
              {hackathon.description || 'No description provided for this event.'}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {NEXT_PHASE_LABEL[hackathon.status] && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={advancePhase}
              className="group flex items-center gap-2.5 rounded-full bg-[#CCFF00] px-6 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(204,255,0,0.15)] transition-shadow hover:shadow-[0_0_30px_rgba(204,255,0,0.25)]"
            >
              {NEXT_PHASE_LABEL[hackathon.status]}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Lifecycle Progress Track */}
      <motion.div 
        variants={container} 
        initial="hidden" 
        animate="show"
        className="relative p-1 rounded-xl bg-[#0A0A0A] border border-white/5 overflow-hidden"
      >
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/2 to-transparent" />
        <div className="relative flex h-12 items-center justify-between px-2">
          {phases.map((phase, i) => {
            const isCompleted = i < currentIdx;
            const isCurrent = i === currentIdx;
            
            return (
              <motion.div 
                key={phase} 
                variants={item}
                className="relative flex flex-col items-center justify-center flex-1 h-full"
              >
                {/* Track Background Segment */}
                <div className="absolute inset-0 border-r border-dashed border-white/5 last:border-0" />
                
                {/* Active Indicator */}
                {isCurrent && (
                  <motion.div 
                    layoutId="activePhase"
                    className="absolute inset-x-1 inset-y-1 rounded-lg bg-[#CCFF00]/[0.07] border border-[#CCFF00]/20"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}

                <div className="relative z-10 flex items-center gap-2">
                   <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                     isCompleted ? 'text-[#CCFF00]' : isCurrent ? 'text-white' : 'text-white/25'
                   }`}>
                    {phase}
                  </span>
                  {isCompleted && (
                     <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#CCFF00]"
                    >
                      <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Metrics & Countdown Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metrics */}
        {[
          { label: 'Teams Registered', value: metrics.teams, icon: Users, color: 'text-emerald-400', trend: '+12%' },
          { label: 'Total Submissions', value: metrics.submissions, icon: FileCode, color: 'text-sky-400', trend: '8 new' },
          { label: 'Judges Assigned', value: metrics.judges, icon: Scale, color: 'text-violet-400', trend: '' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            initial="hidden"
            animate="show"
            className="group relative p-5 rounded-2xl border border-white/5 bg-white/2 backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-white/4"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg bg-white/3 ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              {stat.trend && <span className="text-[10px] font-medium text-[#CCFF00]">{stat.trend}</span>}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white tracking-tight">
                {stat.value}
              </span>
            </div>
            <p className="text-xs text-white/40 mt-1">{stat.label}</p>
          </motion.div>
        ))}

        {/* Countdown Timer */}
        <motion.div
          variants={item}
          initial="hidden"
          animate="show"
          className="relative col-span-2 lg:col-span-1 p-5 rounded-2xl border border-[#CCFF00]/15 bg-[#CCFF00]/2 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="relative">
              <Clock className="w-4 h-4 text-[#CCFF00]" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-ping" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#CCFF00]/80">
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
            <p className="text-white/30 text-sm font-medium">No deadline set</p>
          )}
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Access */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Quick Access
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  to={link.path}
                  key={link.label}
                  className="group relative flex flex-col justify-between h-40 rounded-2xl border border-white/5 bg-white/2 p-5 transition-all duration-300 hover:bg-white/4 hover:border-white/12 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-linear-to-br from-white/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative flex justify-between items-start z-10">
                    <div className={`p-2.5 rounded-xl ${link.bg} border border-white/5`}>
                      <Icon className={`w-4 h-4 ${link.color}`} />
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/3 group-hover:bg-white/6 transition-colors">
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-all group-hover:translate-x-0.5" />
                    </div>
                  </div>

                  <div className="relative z-10">
                    <h4 className="text-lg font-semibold text-white/90 group-hover:text-white transition-colors">
                      {link.label}
                    </h4>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      {link.stat !== null && (
                        <>
                          <span className="text-xl font-bold text-white/60">{link.stat}</span>
                          <span className="text-xs text-white/30">{link.statLabel}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sidebar: Timeline & Config */}
        <div className="space-y-6">
           {/* Timeline */}
           <div className="rounded-2xl border border-white/5 bg-white/2 p-6">
            <h3 className="text-xs font-bold text-white/50 mb-6 flex items-center gap-2 uppercase tracking-widest">
              <Calendar className="h-3.5 w-3.5 text-[#CCFF00]/50" />
              Schedule
            </h3>
            <div className="relative space-y-1">
              {[
                { label: 'Kickoff', date: hackathon.starts_at, icon: Zap },
                { label: 'Submissions Close', date: hackathon.submission_deadline, icon: FileCode },
                { label: 'Judging Begins', date: hackathon.judging_starts, icon: Scale },
              ].filter((event) => event.date).map((event, idx, arr) => {
                const isPast = new Date(event.date!) < new Date();
                const isLast = idx === arr.length - 1;
                const EventIcon = event.icon;
                
                return (
                  <div key={idx} className="relative pl-8 pb-6 last:pb-0">
                    {/* Vertical Line */}
                    {!isLast && (
                       <div className="absolute left-2.75 top-6 bottom-0 w-px bg-linear-to-b from-white/10 to-transparent" />
                    )}

                    {/* Dot */}
                    <div className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border ${isPast ? 'bg-[#CCFF00]/10 border-[#CCFF00]/30' : 'bg-white/3 border-white/10'}`}>
                      <EventIcon className={`w-3 h-3 ${isPast ? 'text-[#CCFF00]' : 'text-white/40'}`} />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/30 mb-0.5">
                          {event.label}
                        </p>
                        <p className="text-sm text-white/70 font-medium">
                          {new Date(event.date!).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {isPast && (
                        <span className="px-2 py-0.5 rounded-full bg-[#CCFF00]/10 text-[10px] font-bold text-[#CCFF00] border border-[#CCFF00]/20">Done</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration */}
          <div className="rounded-2xl border border-white/5 bg-white/2 p-6">
            <h3 className="text-xs font-bold text-white/50 mb-4 flex items-center gap-2 uppercase tracking-widest">
              <Settings2 className="h-3.5 w-3.5 text-[#CCFF00]/50" />
              Config
            </h3>
            <div className="space-y-2">
              {[
                { label: 'Team Limit', value: `${hackathon.max_team_size} Members` },
                { label: 'Created', value: new Date(hackathon.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
              ].map((detail) => (
                <div key={detail.label} className="flex items-center justify-between py-2.5 border-b border-white/3 last:border-0 last:pb-0">
                  <span className="text-xs text-white/35">{detail.label}</span>
                  <span className="text-xs font-medium text-white/70 bg-white/3 px-2 py-1 rounded-md">{detail.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
