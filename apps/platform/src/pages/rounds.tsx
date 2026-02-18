import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  Zap,
  ZapOff,
  Flag,
  Circle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Round {
  id: string;
  name: string;
  round_number: number;
  status: string;
  type: string | null;
  is_initialized: number;
  submission_deadline: string | null;
  created_at: string;
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig = {
  active: {
    label: 'Active',
    color: '#CCFF00',
    bg: 'rgba(204,255,0,0.06)',
    border: 'rgba(204,255,0,0.18)',
    badgeBg: 'rgba(204,255,0,0.1)',
    badgeText: '#CCFF00',
    numberBg: 'rgba(204,255,0,0.12)',
    numberText: '#CCFF00',
  },
  completed: {
    label: 'Completed',
    color: '#34D399',
    bg: 'rgba(52,211,153,0.04)',
    border: 'rgba(52,211,153,0.12)',
    badgeBg: 'rgba(52,211,153,0.1)',
    badgeText: '#34D399',
    numberBg: 'rgba(52,211,153,0.1)',
    numberText: '#34D399',
  },
  pending: {
    label: 'Pending',
    color: 'rgba(255,255,255,0.2)',
    bg: 'rgba(255,255,255,0.015)',
    border: 'rgba(255,255,255,0.06)',
    badgeBg: 'rgba(255,255,255,0.06)',
    badgeText: 'rgba(255,255,255,0.3)',
    numberBg: 'rgba(255,255,255,0.04)',
    numberText: 'rgba(255,255,255,0.2)',
  },
};

function getStatus(status: string) {
  return statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;
}

// ─── Round Card ───────────────────────────────────────────────────────────────

function RoundCard({
  round,
  index,
  total,
  onDelete,
  onToggleInit,
  initializingId,
}: {
  round: Round;
  index: number;
  total: number;
  onDelete: (id: string) => void;
  onToggleInit: (round: Round) => void;
  initializingId: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cfg = getStatus(round.status);
  const isLast = index === total - 1;

  return (
    <motion.div variants={item} className="relative flex gap-0">
      {/* Timeline connector */}
      <div className="flex flex-col items-center mr-5 shrink-0">
        {/* Node */}
        <div
          className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300"
          style={{
            borderColor: cfg.color,
            background: cfg.numberBg,
            boxShadow: round.status === 'active' ? `0 0 20px ${cfg.color}30` : 'none',
          }}
        >
          {round.status === 'completed' ? (
            <CheckCircle className="h-4 w-4" style={{ color: cfg.color }} />
          ) : round.status === 'active' ? (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Zap className="h-4 w-4" style={{ color: cfg.color }} />
            </motion.div>
          ) : (
            <span className="text-xs font-black" style={{ color: cfg.numberText }}>
              {round.round_number}
            </span>
          )}

          {/* Pulse ring for active */}
          {round.status === 'active' && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${cfg.color}` }}
              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </div>

        {/* Connector line */}
        {!isLast && (
          <div className="relative mt-1 w-px flex-1 min-h-5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {round.status === 'active' && (
              <motion.div
                className="absolute top-0 left-0 w-full"
                style={{ background: `linear-gradient(180deg, ${cfg.color}60, transparent)`, height: '50%' }}
                animate={{ y: ['-100%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </div>
        )}
      </div>

      {/* Card */}
      <div className="flex-1 mb-4">
        <motion.div
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
          className="group relative overflow-hidden rounded-2xl border transition-all duration-300"
          style={{
            background: hovered
              ? `linear-gradient(135deg, ${cfg.bg}, rgba(255,255,255,0.02))`
              : cfg.bg,
            borderColor: hovered ? cfg.border : `${cfg.border.replace('0.18', '0.10').replace('0.12', '0.08')}`,
            boxShadow: hovered && round.status === 'active' ? `0 4px 32px ${cfg.color}10` : 'none',
          }}
        >
          {/* Top shimmer line */}
          <div
            className="absolute top-0 left-0 right-0 h-px transition-opacity duration-300"
            style={{
              background: `linear-gradient(90deg, transparent, ${cfg.color}40, transparent)`,
              opacity: hovered ? 1 : 0,
            }}
          />

          <div className="p-5">
            <div className="flex items-center gap-4">
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-2">
                  <h3 className="text-sm font-bold text-white/80 truncate">{round.name}</h3>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: cfg.badgeBg, color: cfg.badgeText }}
                  >
                    {cfg.label}
                  </span>
                  {round.is_initialized ? (
                    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#CCFF00]/10 text-[#CCFF00]">
                      Submissions Open
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/25">
                      Not Initialized
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {round.submission_deadline
                      ? new Date(round.submission_deadline).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'No deadline set'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Flag className="h-3 w-3" />
                    Round {round.round_number}
                  </span>
                </div>
              </div>

              {/* Initialize toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleInit(round); }}
                disabled={initializingId === round.id}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 border ${
                  round.is_initialized
                    ? 'border-red-500/20 bg-red-500/8 text-red-400 hover:bg-red-500/15'
                    : 'border-[#CCFF00]/20 bg-[#CCFF00]/8 text-[#CCFF00] hover:bg-[#CCFF00]/15'
                }`}
              >
                {initializingId === round.id ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="h-3 w-3 rounded-full border-2 border-current/20 border-t-current"
                  />
                ) : round.is_initialized ? (
                  <ZapOff className="h-3 w-3" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {round.is_initialized ? 'Un-initialize' : 'Initialize'}
              </button>

              {/* Delete */}
              <AnimatePresence mode="wait">
                {confirmDelete ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg border border-white/8 px-2.5 py-1.5 text-[11px] text-white/30 hover:text-white/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => onDelete(round.id)}
                      className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-red-500 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="trash"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: hovered ? 1 : 0 }}
                    onClick={() => setConfirmDelete(true)}
                    className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl border border-transparent hover:border-red-500/20 hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all duration-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Add Round Input ──────────────────────────────────────────────────────────

function AddRoundInput({
  value,
  onChange,
  onAdd,
  creating,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  creating: boolean;
}) {
  const [focused, setFocused] = useState(false);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onAdd();
  };

  return (
    <div
      className="flex items-center gap-0 overflow-hidden rounded-xl transition-all duration-200"
      style={{
        border: focused ? '1px solid rgba(204,255,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
        background: focused ? 'rgba(204,255,0,0.03)' : 'rgba(255,255,255,0.03)',
        boxShadow: focused ? '0 0 0 3px rgba(204,255,0,0.05)' : 'none',
      }}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Round name..."
        className="bg-transparent px-4 py-2.5 text-sm text-white/80 placeholder:text-white/15 outline-none w-44"
      />
      <button
        onClick={onAdd}
        disabled={creating || !value.trim()}
        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40 transition-all"
        style={{
          background: value.trim() ? 'linear-gradient(135deg, #CCFF00, #b8e600)' : 'rgba(255,255,255,0.05)',
          color: value.trim() ? '#000' : 'rgba(255,255,255,0.2)',
        }}
      >
        {creating ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            className="h-4 w-4 rounded-full border-2 border-black/20 border-t-black"
          />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Add
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function RoundsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [initializingId, setInitializingId] = useState<string | null>(null);

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
      const nextNumber = rounds.length > 0 ? Math.max(...rounds.map(r => r.round_number)) + 1 : 1;
      await apiRequest(`/api/v1/hackathons/${slug}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), round_number: nextNumber }),
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

  const handleToggleInit = async (round: Round) => {
    if (!slug) return;
    setInitializingId(round.id);
    try {
      const newValue = !round.is_initialized;
      await apiRequest(`/api/v1/hackathons/${slug}/rounds/${round.id}/initialize`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_initialized: newValue }),
      });
      toast.success(newValue ? `Round "${round.name}" initialized — submissions open` : `Round "${round.name}" un-initialized — submissions closed`);
      fetchRounds();
    } catch {
      toast.error('Failed to update round initialization');
    } finally {
      setInitializingId(null);
    }
  };

  // Stats
  const completed = rounds.filter((r) => r.status === 'completed').length;
  const active = rounds.filter((r) => r.status === 'active').length;

  return (
    <div>
      <PageHeader
        title="Rounds"
        description="Track elimination rounds and team progression."
        actions={
          <AddRoundInput
            value={newName}
            onChange={setNewName}
            onAdd={handleCreate}
            creating={creating}
          />
        }
      />

      {/* Stats row */}
      {!loading && rounds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-6 flex items-center gap-3"
        >
          {[
            { label: 'Total', value: rounds.length, color: 'rgba(255,255,255,0.4)' },
            { label: 'Completed', value: completed, color: '#34D399' },
            { label: 'Active', value: active, color: '#CCFF00' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/2 px-4 py-2"
            >
              <span className="text-lg font-black" style={{ color: stat.color }}>{stat.value}</span>
              <span className="text-[10px] uppercase tracking-widest text-white/25">{stat.label}</span>
            </div>
          ))}

          {/* Progress bar */}
          {rounds.length > 0 && (
            <div className="flex-1 flex items-center gap-3 ml-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #34D399, #CCFF00)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(completed / rounds.length) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <span className="text-[10px] text-white/20 shrink-0">
                {Math.round((completed / rounds.length) * 100)}%
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              className="h-8 w-8 rounded-full border-2 border-white/05 border-t-[#CCFF00]"
            />
            <div className="absolute inset-0 rounded-full blur-sm opacity-40" style={{ background: 'radial-gradient(circle, #CCFF00 0%, transparent 70%)' }} />
          </div>
          <p className="text-[10px] uppercase tracking-widest text-white/20">Loading rounds</p>
        </div>
      ) : rounds.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <EmptyState
            icon={Award}
            title="No rounds yet"
            description="Create judging rounds to organize your hackathon's evaluation process."
          />
        </motion.div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show">
          {rounds.map((round, i) => (
            <RoundCard
              key={round.id}
              round={round}
              index={i}
              total={rounds.length}
              onDelete={handleDelete}
              onToggleInit={handleToggleInit}
              initializingId={initializingId}
            />
          ))}

          {/* End cap */}
          <motion.div variants={item} className="flex items-center gap-5 pl-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-white/8">
              <Trophy className="h-4 w-4 text-white/15" />
            </div>
            <span className="text-xs text-white/20 uppercase tracking-widest">Final results</span>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
