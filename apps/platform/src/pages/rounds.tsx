import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageHeader, EmptyState } from '@/components/common';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';
import {
  Award,
  Trophy,
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
  Plus,
  Trash2,
} from 'lucide-react';

interface Round {
  id: string;
  name: string;
  round_number: number;
  status: string;
  type: string | null;
  submission_deadline: string | null;
  created_at: string;
}

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
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const fetchRounds = async () => {
    if (!slug) return;
    try {
      const res = await apiRequest<{ data: Round[] }>(`/api/v1/hackathons/${slug}/rounds`);
      setRounds(res.data ?? []);
    } catch {
      setRounds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRounds(); }, [slug]);

  const handleCreate = async () => {
    if (!slug || !newName.trim()) return;
    setCreating(true);
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), round_number: rounds.length + 1 }),
      });
      toast.success('Round created');
      setNewName('');
      fetchRounds();
    } catch {
      toast.error('Failed to create round');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (roundId: string) => {
    if (!slug) return;
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/rounds/${roundId}`, { method: 'DELETE' });
      toast.success('Round deleted');
      fetchRounds();
    } catch {
      toast.error('Failed to delete round');
    }
  };

  return (
    <div>
      <PageHeader
        title="Rounds"
        description="Track elimination rounds and team progression."
        actions={
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Round name..."
              className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm text-white/80 placeholder:text-white/15 outline-none focus:border-[#CCFF00]/30 w-40"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="flex items-center gap-1 rounded-xl bg-[#CCFF00] px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-6 w-6 rounded-full border-2 border-white/10 border-t-[#CCFF00]"
          />
        </div>
      ) : rounds.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No rounds yet"
          description="Create judging rounds to organize your hackathon's evaluation process."
        />
      ) : (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        {rounds.map((round, i) => (
          <motion.div
            key={round.id}
            variants={item}
            className={`group relative rounded-2xl border p-6 transition-all duration-300 ${
              round.status === 'active'
                ? 'border-[#CCFF00]/20 bg-[#CCFF00]/4'
                : round.status === 'completed'
                  ? 'border-white/8 bg-white/3'
                  : 'border-white/ bg-white/2'
            }`}
          >
            {/* Active indicator */}
            {round.status === 'active' && (
              <motion.div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-0.75 rounded-r-full bg-[#CCFF00]"
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
                    : 'bg-white/4 text-white/20'
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
                    'bg-white/6 text-white/30'
                  }`}>
                    {round.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/25">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {round.submission_deadline
                      ? new Date(round.submission_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'No deadline'}
                  </span>
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(round.id)}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:bg-red-500/10 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

          </motion.div>
        ))}
      </motion.div>
      )}
    </div>
  );
}
