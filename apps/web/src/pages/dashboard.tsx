import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import {
  Sparkles,
  Rocket,
  Trophy,
  Clock,
  CalendarDays,
  Users,
  ArrowRight,
  Zap,
} from 'lucide-react';

/* ──────────── Types ──────────── */

interface Hackathon {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  primary_color?: string | null;
  banner_r2_key?: string | null;
  logo_r2_key?: string | null;
  status: 'draft' | 'registration_open' | 'registration_closed' | 'active' | 'judging' | 'completed' | 'archived';
  registration_opens: string;
  registration_closes: string;
  submission_deadline: string;
  max_team_size: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface HackathonListResponse {
  ok: boolean;
  data: Hackathon[];
  meta: { total: number; limit: number; offset: number };
}

/* ──────────── Helpers ──────────── */

type Tab = 'upcoming' | 'ongoing' | 'past';

const TAB_META: Record<Tab, { label: string; icon: typeof Sparkles; color: string; emptyMsg: string }> = {
  upcoming: {
    label: 'Upcoming',
    icon: Sparkles,
    color: '#CCFF00',
    emptyMsg: 'No upcoming hackathons right now — check back soon!',
  },
  ongoing: {
    label: 'Ongoing',
    icon: Rocket,
    color: '#00D4FF',
    emptyMsg: "No hackathons are currently in progress.",
  },
  past: {
    label: 'Past',
    icon: Trophy,
    color: '#FF6B6B',
    emptyMsg: 'No completed hackathons yet.',
  },
};

function categorise(hackathons: Hackathon[]) {
  const upcoming: Hackathon[] = [];
  const ongoing: Hackathon[] = [];
  const past: Hackathon[] = [];

  for (const h of hackathons) {
    if (h.status === 'draft' || h.status === 'registration_open') {
      upcoming.push(h);
    } else if (h.status === 'registration_closed' || h.status === 'active') {
      ongoing.push(h);
    } else {
      past.push(h);
    }
  }

  return { upcoming, ongoing, past };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_PILL: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: 'bg-white/10', text: 'text-white/60' },
  registration_open: { label: 'Registration Open', bg: 'bg-[#CCFF00]/20', text: 'text-[#CCFF00]' },
  registration_closed: { label: 'Registration Closed', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  active: { label: 'Hacking', bg: 'bg-[#00D4FF]/20', text: 'text-[#00D4FF]' },
  judging: { label: 'Judging', bg: 'bg-purple-500/20', text: 'text-purple-400' },
  completed: { label: 'Completed', bg: 'bg-white/10', text: 'text-white/50' },
  archived: { label: 'Archived', bg: 'bg-white/5', text: 'text-white/30' },
};

/* ──────────── Components ──────────── */

function HackathonCard({ hackathon }: { hackathon: Hackathon }) {
  const pill = STATUS_PILL[hackathon.status] ?? STATUS_PILL.draft;
  const accent = hackathon.primary_color ?? '#CCFF00';

  const heroStyle = hackathon.banner_r2_key
    ? { background: `url('/r2/${hackathon.banner_r2_key}') center/cover no-repeat, linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.25))` }
    : { background: `linear-gradient(135deg, ${accent}20, #00000000)` };

  return (
    <Link to={`/hackathons/${hackathon.slug}`} className="group block">
      <motion.div
        whileHover={{ y: -6 }}
        className="relative overflow-hidden rounded-2xl border border-white/8 transition-shadow"
        style={{ boxShadow: `0 6px 30px ${accent}20` }}
      >
        <div className="p-6" style={heroStyle}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider`} style={{ background: `${accent}22`, color: accent }}>
                {pill.label}
              </span>

              {/* Expanded title area */}
              <h3 className="mt-4 text-2xl md:text-3xl font-extrabold text-white line-clamp-2 transition-colors group-hover:text-opacity-95" style={{ color: accent }}>
                {hackathon.title}
              </h3>

              <p className="mt-3 text-sm text-white/60 line-clamp-3">
                {hackathon.description}
              </p>
            </div>

            <div className="shrink-0 self-start">
              {hackathon.logo_r2_key ? (
                <img src={`/r2/${hackathon.logo_r2_key}`} alt="logo" className="h-20 w-20 rounded-lg object-cover border" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-white/5 flex items-center justify-center text-xl font-bold text-white/60">S</div>
              )}
            </div>
          </div>

          {/* Meta row — moved down */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Opens {formatDate(hackathon.registration_opens)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Due {formatDate(hackathon.submission_deadline)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              Max {hackathon.max_team_size}
            </span>
          </div>
        </div>

        {/* Card footer arrow */}
        <div className="absolute bottom-4 right-4">
          <ArrowRight className="h-5 w-5 text-white/20 transition-all group-hover:translate-x-1 group-hover:text-white/90" />
        </div>
      </motion.div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/3 p-6">
      <div className="h-4 w-24 rounded-full bg-white/10" />
      <div className="mt-4 h-5 w-2/3 rounded bg-white/10" />
      <div className="mt-3 h-3 w-full rounded bg-white/5" />
      <div className="mt-1.5 h-3 w-4/5 rounded bg-white/5" />
      <div className="mt-5 flex gap-4">
        <div className="h-3 w-20 rounded bg-white/5" />
        <div className="h-3 w-20 rounded bg-white/5" />
      </div>
    </div>
  );
}

/* ──────────── Main Page ──────────── */

export function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [error, setError] = useState<string | null>(null);

  // Show loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <div className="max-w-lg w-full p-8 rounded-xl border border-blue-500 bg-blue-900/20">
          <h2 className="text-2xl font-bold mb-4 text-blue-400">Loading Dashboard...</h2>
          <div className="animate-pulse h-6 w-2/3 bg-white/10 rounded mb-4" />
          <div className="animate-pulse h-6 w-1/2 bg-white/10 rounded" />
        </div>
      </div>
    );
  }
  // Show error fallback
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <div className="max-w-lg w-full p-8 rounded-xl border border-red-500 bg-red-900/20">
          <h2 className="text-2xl font-bold mb-4 text-red-400">Error</h2>
          <p className="mb-6 text-red-200">{error}</p>
          <button className="mt-4 px-4 py-2 rounded bg-red-700 text-white" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }
  // Show empty fallback
  if (!hackathons || hackathons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <div className="max-w-lg w-full p-8 rounded-xl border border-yellow-500 bg-yellow-900/20">
          <h2 className="text-2xl font-bold mb-4 text-yellow-400">No Hackathons Found</h2>
          <p className="mb-6 text-yellow-200">There are currently no hackathons available. Please check back later or contact support if this persists.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const res = await apiRequest<HackathonListResponse>('/api/v1/hackathons');
        setHackathons(res.data);
      } catch (err) {
        setError('Failed to load dashboard. Please check your connection or try again later.');
        toast.error('Failed to load hackathons');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <div className="max-w-lg w-full p-8 rounded-xl border border-red-500 bg-red-900/20">
          <h2 className="text-2xl font-bold mb-4 text-red-400">Error</h2>
          <p className="mb-6 text-red-200">{error}</p>
          <button className="mt-4 px-4 py-2 rounded bg-red-700 text-white" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  const { upcoming, ongoing, past } = categorise(hackathons);
  const buckets: Record<Tab, Hackathon[]> = { upcoming, ongoing, past };
  const active = buckets[activeTab];
  const meta = TAB_META[activeTab];

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-white/50">
          <Zap className="h-3.5 w-3.5 text-[#CCFF00]" />
          Dashboard
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
          Welcome back{user?.display_name ? `, ${user.display_name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-white/50">Browse hackathons, join a team, and start building.</p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {([
          { label: 'Upcoming', count: upcoming.length, color: '#CCFF00' },
          { label: 'Ongoing', count: ongoing.length, color: '#00D4FF' },
          { label: 'Past', count: past.length, color: '#FF6B6B' },
        ]).map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/10 bg-white/3 p-4"
          >
            <p className="text-xs uppercase tracking-widest text-white/40">{s.label}</p>
            <p className="mt-1 text-2xl font-black" style={{ color: s.color }}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(Object.keys(TAB_META) as Tab[]).map((tab) => {
          const m = TAB_META[tab];
          const Icon = m.icon;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-white/40 hover:text-white/70 border border-transparent'
              }`}
            >
              <Icon className="h-4 w-4" style={{ color: isActive ? m.color : undefined }} />
              {m.label}
              <span
                className={`ml-1 rounded-full px-1.5 text-[10px] font-bold ${
                  isActive ? 'bg-white/10 text-white' : 'bg-white/5 text-white/30'
                }`}
              >
                {buckets[tab].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cards grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : active.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-20 text-center">
              <meta.icon className="h-10 w-10 text-white/20" />
              <p className="mt-4 text-sm text-white/40">{meta.emptyMsg}</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((h) => (
                <HackathonCard key={h.id} hackathon={h} />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
