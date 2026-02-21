import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageHeader, EmptyState } from '@/components/common';
import { apiRequest } from '@/lib/api';
import {
  Activity,
  GitCommit,
  Users,
  Trophy,
  FileText,
  Shield,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

interface AuditEvent {
  id: string;
  action: string;
  actor_type: string;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

const iconMap: Record<string, typeof Activity> = {
  'team.created': Users,
  'team.joined': Users,
  'submission.created': FileText,
  'submission.validated': FileText,
  'judge.invited': Trophy,
  'score.submitted': Trophy,
  'hackathon.phase_advanced': Shield,
  'hackathon.settings_updated': Shield,
};

const colorMap: Record<string, string> = {
  'team.created': 'text-blue-400 bg-blue-500/10',
  'team.joined': 'text-blue-400 bg-blue-500/10',
  'submission.created': 'text-emerald-400 bg-emerald-500/10',
  'submission.validated': 'text-emerald-400 bg-emerald-500/10',
  'judge.invited': 'text-amber-400 bg-amber-500/10',
  'score.submitted': 'text-amber-400 bg-amber-500/10',
  'hackathon.phase_advanced': 'text-[#CCFF00] bg-[#CCFF00]/10',
  'hackathon.settings_updated': 'text-purple-400 bg-purple-500/10',
};

export function ActivityPage() {
  const { slug } = useParams<{ slug: string }>();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await apiRequest<{ data: AuditEvent[] }>(`/api/v1/hackathons/${slug}/audit`);
        setEvents(res.data ?? []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Real-time audit trail of all hackathon events."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-6 w-6 rounded-full border-2 border-white/10 border-t-[#CCFF00]"
          />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Events will appear here as the hackathon progresses."
        />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="relative">
          {/* Timeline line */}
          <div className="absolute left-5.75 top-3 bottom-3 w-px bg-white/6" />

          <div className="space-y-1">
            {events.map((event) => {
              const Icon = iconMap[event.action] || Activity;
              const color = colorMap[event.action] || 'text-white/30 bg-white/4';

              return (
                <motion.div
                  key={event.id}
                  variants={item}
                  className="group relative flex items-start gap-4 rounded-xl px-2 py-3 transition-all duration-200 hover:bg-white/2"
                >
                  {/* Icon dot */}
                  <div className={`relative z-10 flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm text-white/60 leading-snug">
                      {event.actor_type === 'system' && (
                        <span className="font-semibold text-white/40">System </span>
                      )}
                      {event.actor_type === 'cron' && (
                        <span className="font-semibold text-white/40">Cron </span>
                      )}
                      <span className="font-medium text-white/70">{event.action}</span>
                      {event.entity_type && (
                        <span className="text-white/30"> on {event.entity_type}</span>
                      )}
                    </p>
                  </div>

                  {/* Time */}
                  <span className="shrink-0 pt-1 text-[10px] tabular-nums text-white/20">
                    {formatTime(event.created_at)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
