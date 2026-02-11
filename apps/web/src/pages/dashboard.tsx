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
  title: string;
  description: string;
  status: 'DRAFT' | 'REGISTRATION_OPEN' | 'HACKING' | 'SUBMISSION_CLOSED' | 'COMPLETED';
  registration_start_date: string;
  hacking_start_date: string;
  submission_deadline: string;
  max_team_size: number;
  organiser_id: string;
  created_at: string;
  updated_at: string;
}

interface HackathonListResponse {
  data: Hackathon[];
  total: number;
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
    if (h.status === 'DRAFT' || h.status === 'REGISTRATION_OPEN') {
      upcoming.push(h);
    } else if (h.status === 'HACKING') {
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
  DRAFT: { label: 'Draft', bg: 'bg-white/10', text: 'text-white/60' },
  REGISTRATION_OPEN: { label: 'Registration Open', bg: 'bg-[#CCFF00]/20', text: 'text-[#CCFF00]' },
  HACKING: { label: 'Hacking', bg: 'bg-[#00D4FF]/20', text: 'text-[#00D4FF]' },
  SUBMISSION_CLOSED: { label: 'Submissions Closed', bg: 'bg-orange-500/20', text: 'text-orange-400' },
  COMPLETED: { label: 'Completed', bg: 'bg-white/10', text: 'text-white/50' },
};

/* ──────────── Components ──────────── */

function HackathonCard({ hackathon }: { hackathon: Hackathon }) {
  const pill = STATUS_PILL[hackathon.status] ?? STATUS_PILL.DRAFT;

  return (
    <Link to={`/hackathons/${hackathon.id}`} className="group block">
      <motion.div
        whileHover={{ y: -4 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/3 p-6 transition-colors hover:border-[#CCFF00]/30 hover:bg-white/6"
      >
        {/* Glow on hover */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#CCFF00]/0 blur-[80px] transition-all duration-500 group-hover:bg-[#CCFF00]/10" />

        {/* Status pill */}
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${pill.bg} ${pill.text}`}>
          {pill.label}
        </span>

        {/* Title */}
        <h3 className="mt-3 text-lg font-bold text-white line-clamp-1 group-hover:text-[#CCFF00] transition-colors">
          {hackathon.title}
        </h3>

        {/* Description */}
        <p className="mt-1.5 text-sm text-white/50 line-clamp-2">
          {hackathon.description}
        </p>

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-white/40">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            Starts {formatDate(hackathon.hacking_start_date)}
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

        {/* Arrow */}
        <ArrowRight className="absolute bottom-6 right-6 h-5 w-5 text-white/20 transition-all group-hover:translate-x-1 group-hover:text-[#CCFF00]" />
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
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest<HackathonListResponse>('/hackathons');
        setHackathons(res.data);
      } catch {
        toast.error('Failed to load hackathons');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
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
