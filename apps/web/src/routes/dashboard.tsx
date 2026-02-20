import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/features/auth/use-auth';
import { Zap, Sparkles, Rocket, Trophy, Clock, CalendarDays, Users, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useState } from 'react';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    // Route guard — auth check happens client-side via the component
    // TanStack Router will redirect in the component if session is missing
  },
  component: DashboardPage,
});

interface Hackathon {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  primary_color?: string | null;
  status: 'draft' | 'active' | 'judging' | 'completed' | 'archived';
  starts_at: string | null;
  submission_deadline: string;
  max_team_size: number;
  created_at: string;
}

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
    emptyMsg: 'No hackathons are currently in progress.',
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
    if (h.status === 'draft') upcoming.push(h);
    else if (h.status === 'active' || h.status === 'judging') ongoing.push(h);
    else past.push(h);
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

function DashboardPage() {
  const { user, isAuthenticated, isPending } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');

  // Redirect to login if not authenticated
  if (!isPending && !isAuthenticated) {
    navigate({ to: '/login' });
    return null;
  }

  const { data: hackathons = [], isLoading } = useQuery({
    queryKey: ['hackathons'],
    queryFn: async () => {
      const res = await apiRequest<{ ok: boolean; data: Hackathon[]; meta: unknown }>('/api/v1/hackathons');
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const { upcoming, ongoing, past } = categorise(hackathons);
  const buckets: Record<Tab, Hackathon[]> = { upcoming, ongoing, past };
  const active = buckets[activeTab];
  const meta = TAB_META[activeTab];

  if (isPending) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-80 animate-pulse rounded bg-white/5" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto max-w-7xl px-6 py-10">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(204,255,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(204,255,0,0.02)_1px,transparent_1px)] bg-size-[60px_60px]" />
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-[#CCFF00]/5 blur-[160px]" />
      </div>

      <div className="relative space-y-10">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-white/50">
            <Zap className="h-3.5 w-3.5 text-[#CCFF00]" />
            Dashboard
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            {user?.image && (
              <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
            )}
            <p className="text-white/50">
              {user?.email ?? 'Browse hackathons, join a team, and start building.'}
            </p>
          </div>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            { label: 'Upcoming', count: upcoming.length, color: '#CCFF00' },
            { label: 'Ongoing', count: ongoing.length, color: '#00D4FF' },
            { label: 'Past', count: past.length, color: '#FF6B6B' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-widest text-white/40">{s.label}</p>
              <p className="mt-1 text-2xl font-black" style={{ color: s.color }}>
                {s.count}
              </p>
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

        {/* Hackathon cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="h-4 w-24 rounded-full bg-white/10" />
                    <div className="mt-4 h-5 w-2/3 rounded bg-white/10" />
                    <div className="mt-3 h-3 w-full rounded bg-white/5" />
                    <div className="mt-5 flex gap-4">
                      <div className="h-3 w-20 rounded bg-white/5" />
                      <div className="h-3 w-20 rounded bg-white/5" />
                    </div>
                  </div>
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
                  <a key={h.id} href={`/hackathons/${h.slug}`} className="group block">
                    <motion.div
                      whileHover={{ y: -4 }}
                      className="overflow-hidden rounded-2xl border border-white/8 p-6 transition-shadow"
                      style={{ boxShadow: `0 4px 24px ${h.primary_color ?? '#CCFF00'}15` }}
                    >
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                        style={{
                          background: `${h.primary_color ?? '#CCFF00'}22`,
                          color: h.primary_color ?? '#CCFF00',
                        }}
                      >
                        {h.status}
                      </span>
                      <h3
                        className="mt-4 text-xl font-extrabold text-white transition-colors group-hover:text-opacity-95"
                        style={{ color: h.primary_color ?? '#CCFF00' }}
                      >
                        {h.title}
                      </h3>
                      {h.description && (
                        <p className="mt-2 text-sm text-white/50 line-clamp-2">{h.description}</p>
                      )}
                      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-white/40">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {h.starts_at ? `Starts ${formatDate(h.starts_at)}` : 'Start TBD'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Due {formatDate(h.submission_deadline)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          Max {h.max_team_size}
                        </span>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <ArrowRight className="h-5 w-5 text-white/20 transition group-hover:translate-x-1 group-hover:text-white/60" />
                      </div>
                    </motion.div>
                  </a>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
