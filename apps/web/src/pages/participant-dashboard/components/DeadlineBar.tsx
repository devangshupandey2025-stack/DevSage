/* ─────────────────────────────────────────────────────────────
   DeadlineBar — Countdown timers for key hackathon milestones
   
   Renders a horizontal strip of deadline countdowns with
   color-coded urgency states.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { HackathonStatus } from '../types';
import { formatRelativeTime } from '../utils';

interface DeadlineInfo {
  label: string;
  date: Date;
  isPast: boolean;
  isImminent: boolean;
  relative: string;
}

interface DeadlineBarProps {
  deadlines: DeadlineInfo[];
  hackathonStatus: HackathonStatus;
}

export function DeadlineBar({ deadlines, hackathonStatus }: DeadlineBarProps) {
  // Re-render every 30s to keep relative times fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (deadlines.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {deadlines.map((dl) => {
        const now = new Date();
        const diff = dl.date.getTime() - now.getTime();
        const isPast = diff < 0;
        const isImminent = diff > 0 && diff < 7_200_000;
        const relative = formatRelativeTime(dl.date);

        let borderColor = 'border-white/8';
        let bgColor = 'bg-white/2';
        let textColor = 'text-white/50';
        let iconColor = 'text-white/30';
        let Icon = Clock;

        if (isPast) {
          borderColor = 'border-white/6';
          bgColor = 'bg-white/[0.01]';
          textColor = 'text-white/25';
          iconColor = 'text-white/20';
          Icon = CheckCircle2;
        } else if (isImminent) {
          borderColor = 'border-amber-500/25';
          bgColor = 'bg-amber-500/5';
          textColor = 'text-amber-300';
          iconColor = 'text-amber-400';
          Icon = AlertTriangle;
        }

        return (
          <div
            key={dl.label}
            className={`flex items-center gap-2.5 rounded-xl border ${borderColor} ${bgColor} px-4 py-2.5`}
          >
            <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
            <div>
              <p className="text-[11px] text-white/30 uppercase tracking-wider">
                {dl.label}
              </p>
              <p className={`text-sm font-semibold ${textColor}`}>
                {isPast ? 'Passed' : relative}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
