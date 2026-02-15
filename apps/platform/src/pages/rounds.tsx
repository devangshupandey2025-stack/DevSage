import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageHeader, EmptyState } from '@/components/common';
import {
  Award,
  Trophy,
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface Round {
  id: string;
  name: string;
  round_number: number;
  status: 'upcoming' | 'active' | 'completed';
  teams_count: number;
  eliminated_count: number;
  deadline: string;
}

// Mock data for UI demonstration
const mockRounds: Round[] = [
  { id: '1', name: 'Qualification Round', round_number: 1, status: 'completed', teams_count: 50, eliminated_count: 20, deadline: '2026-03-15T23:59:00Z' },
  { id: '2', name: 'Semi-Finals', round_number: 2, status: 'active', teams_count: 30, eliminated_count: 0, deadline: '2026-03-20T23:59:00Z' },
  { id: '3', name: 'Finals', round_number: 3, status: 'upcoming', teams_count: 0, eliminated_count: 0, deadline: '2026-03-25T23:59:00Z' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export function RoundsPage() {
  const { slug } = useParams<{ slug: string }>();
  const rounds = mockRounds; // Replace with API call

  return (
    <div>
      <PageHeader
        title="Rounds"
        description="Track elimination rounds and team progression."
      />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        {rounds.map((round, i) => (
          <motion.div
            key={round.id}
            variants={item}
            className={`group relative rounded-2xl border p-6 transition-all duration-300 ${
              round.status === 'active'
                ? 'border-[#CCFF00]/20 bg-[#CCFF00]/[0.04]'
                : round.status === 'completed'
                  ? 'border-white/[0.08] bg-white/[0.03]'
                  : 'border-white/[0.06] bg-white/[0.02]'
            }`}
          >
            {/* Active indicator */}
            {round.status === 'active' && (
              <motion.div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-full bg-[#CCFF00]"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}

            <div className="flex items-center gap-6">
              {/* Round number */}
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${
                round.status === 'active'
                  ? 'bg-[#CCFF00]/15 text-[#CCFF00]'
                  : round.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-white/[0.04] text-white/20'
              }`}>
                {round.status === 'completed' ? <CheckCircle className="h-6 w-6" /> : round.round_number}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-white/80">{round.name}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    round.status === 'active' ? 'bg-[#CCFF00]/10 text-[#CCFF00]' :
                    round.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-white/[0.06] text-white/30'
                  }`}>
                    {round.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/25">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {round.teams_count} teams
                  </span>
                  {round.eliminated_count > 0 && (
                    <span className="text-red-400/60">
                      {round.eliminated_count} eliminated
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(round.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Progress */}
              {round.status !== 'upcoming' && (
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-black tabular-nums text-white/60">
                    {round.status === 'completed' ? '100' : '67'}%
                  </p>
                  <p className="text-[10px] text-white/20 uppercase tracking-wider">Progress</p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {round.status !== 'upcoming' && (
              <div className="mt-4 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${round.status === 'completed' ? 'bg-emerald-400' : 'bg-[#CCFF00]'}`}
                  initial={{ width: 0 }}
                  animate={{ width: round.status === 'completed' ? '100%' : '67%' }}
                  transition={{ duration: 1, delay: 0.2 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
