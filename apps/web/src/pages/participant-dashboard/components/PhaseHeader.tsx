/* ─────────────────────────────────────────────────────────────
   PhaseHeader — Context-aware header for each dashboard phase
   
   Shows different messaging, colors, and context based on the
   current hackathon lifecycle phase.
   ───────────────────────────────────────────────────────────── */
import {
  Rocket,
  Clock,
  Trophy,
  Gavel,
  UserPlus,
  Zap,
  Lock,
  CalendarCheck,
} from 'lucide-react';
import type { Hackathon, Team, DashboardPhase } from '../types';

interface PhaseHeaderProps {
  hackathon: Hackathon;
  phase: DashboardPhase;
  team: Team | null;
  userName: string;
}

const PHASE_CONFIG: Record<
  DashboardPhase,
  {
    icon: typeof Rocket;
    color: string;
    badge: string;
    heading: (name: string) => string;
    sub: string;
  }
> = {
  pre_registration: {
    icon: CalendarCheck,
    color: '#818CF8',
    badge: 'Coming Soon',
    heading: (name) => `Hey ${name}, registration hasn't opened yet`,
    sub: 'Check back when registration opens to join a team and start building.',
  },
  registration: {
    icon: UserPlus,
    color: '#CCFF00',
    badge: 'Registration Open',
    heading: (name) => `Welcome, ${name}!`,
    sub: 'Register your team, connect your repo, and get ready to build.',
  },
  no_team: {
    icon: UserPlus,
    color: '#FF6B6B',
    badge: 'Action Required',
    heading: (name) => `${name}, you need a team`,
    sub: 'Create or join a team to participate in this hackathon.',
  },
  pre_hacking: {
    icon: Clock,
    color: '#00D4FF',
    badge: 'Starting Soon',
    heading: (name) => `Almost time, ${name}`,
    sub: 'Registration is closed. The hacking phase begins soon — make sure your repo is linked.',
  },
  hacking: {
    icon: Rocket,
    color: '#CCFF00',
    badge: 'Hacking',
    heading: (name) => `Build mode, ${name} 🚀`,
    sub: 'Push git tags to submit. Your latest validated tag is your entry.',
  },
  submission_locked: {
    icon: Lock,
    color: '#F59E0B',
    badge: 'Deadline Passed',
    heading: (_name) => 'Submissions are locked',
    sub: 'The submission window has closed. Awaiting judging.',
  },
  judging: {
    icon: Gavel,
    color: '#A855F7',
    badge: 'Judging',
    heading: (_name) => 'Judging in progress',
    sub: 'Judges are reviewing submissions. Results will appear on the leaderboard.',
  },
  completed: {
    icon: Trophy,
    color: '#10B981',
    badge: 'Completed',
    heading: (_name) => 'Hackathon complete',
    sub: 'Final results are in. Check the leaderboard for standings.',
  },
};

export function PhaseHeader({
  hackathon,
  phase,
  team,
  userName,
}: PhaseHeaderProps) {
  const config = PHASE_CONFIG[phase];
  const Icon = config.icon;

  return (
    <div>
      {/* Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.2em]">
        <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
        <span style={{ color: config.color }} className="font-bold">
          {config.badge}
        </span>
      </div>

      {/* Title */}
      <h1 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">
        {config.heading(userName)}
      </h1>

      {/* Subtitle with hackathon name */}
      <p className="mt-1 text-white/50 text-sm">
        {config.sub}
        <span className="text-white/30"> — </span>
        <span className="text-white/40 font-medium">{hackathon.title}</span>
      </p>
    </div>
  );
}
