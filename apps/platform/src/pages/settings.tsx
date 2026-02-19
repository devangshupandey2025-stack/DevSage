import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { PageHeader } from '@/components/common';
import {
  Settings,
  Save,
  Calendar,
  Users,
  Globe,
  Shield,
  Trash2,
  AlertTriangle,
  Check,
  Image,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';

// ─── Animation Variants ───────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

// ─── Section Component ────────────────────────────────────────────────────────

function SettingsSection({
  title,
  icon: Icon,
  accent = '#CCFF00',
  children,
}: {
  title: string;
  icon: typeof Settings;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={item}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-sm transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.04]"
    >
      {/* Ambient glow on hover */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle, ${accent}08 0%, transparent 70%)` }}
      />

      {/* Top accent bar */}
      <div
        className="absolute top-0 left-6 right-6 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }}
      />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300"
            style={{ background: `${accent}10`, border: `1px solid ${accent}20` }}
          >
            <Icon className="h-4 w-4 transition-colors duration-300" style={{ color: `${accent}80` }} />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-widest uppercase text-white/50">{title}</h3>
          </div>
          <div className="ml-auto flex items-center">
            <ChevronRight className="h-3.5 w-3.5 text-white/10 group-hover:text-white/20 transition-colors" />
          </div>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

// ─── Input Field ──────────────────────────────────────────────────────────────

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="group/field">
      <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/25 transition-colors group-focus-within/field:text-white/50">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="w-full rounded-xl border bg-black/20 px-4 py-3 text-sm text-white/80 placeholder:text-white/15 outline-none transition-all duration-200"
          style={{
            borderColor: focused ? 'rgba(204,255,0,0.3)' : 'rgba(255,255,255,0.06)',
            boxShadow: focused ? '0 0 0 3px rgba(204,255,0,0.05), inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.02)',
          }}
        />
        <AnimatePresence>
          {focused && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0 }}
              className="absolute bottom-0 left-4 right-4 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #CCFF00, transparent)', transformOrigin: 'center' }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Toggle Field ─────────────────────────────────────────────────────────────

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="group/toggle flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-transparent p-3 transition-all duration-200 hover:border-white/[0.06] hover:bg-white/[0.02]"
      onClick={() => onChange(!checked)}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-white/70 group-hover/toggle:text-white/85 transition-colors">{label}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-white/25">{description}</p>
      </div>

      <div className="shrink-0">
        <div
          className="relative h-[26px] w-12 rounded-full transition-all duration-300"
          style={{
            background: checked
              ? 'linear-gradient(135deg, #CCFF00, #a3d400)'
              : 'rgba(255,255,255,0.08)',
            boxShadow: checked ? '0 0 16px rgba(204,255,0,0.25)' : 'none',
          }}
        >
          <motion.div
            className="absolute top-[3px] h-5 w-5 rounded-full shadow-lg"
            animate={{ left: checked ? 23 : 3 }}
            transition={{ type: 'spring', stiffness: 600, damping: 35 }}
            style={{ background: checked ? '#000' : 'rgba(255,255,255,0.45)' }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = {
    draft: { label: 'Draft', color: '#888', bg: 'rgba(136,136,136,0.1)', border: 'rgba(136,136,136,0.2)' },
    active: { label: 'Live', color: '#CCFF00', bg: 'rgba(204,255,0,0.08)', border: 'rgba(204,255,0,0.2)' },
    ended: { label: 'Ended', color: '#FF6B6B', bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.2)' },
  }[status] ?? { label: status, color: '#888', bg: 'rgba(136,136,136,0.1)', border: 'rgba(136,136,136,0.2)' };

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}
    >
      {status === 'active' && (
        <motion.div
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: config.color }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      {config.label}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HackathonSettings {
  title: string;
  tagline: string | null;
  min_team_size: number;
  max_team_size: number;
  starts_at: string | null;
  judging_starts: string | null;
  registration_mode: string | null;
  allow_resubmission: number;
  status: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [maxTeamSize, setMaxTeamSize] = useState('5');
  const [minTeamSize, setMinTeamSize] = useState('1');
  const [startsAt, setStartsAt] = useState('');
  const [subDeadline, setSubDeadline] = useState('');
  const [publicListing, setPublicListing] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [allowLateSubmissions, setAllowLateSubmissions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hackathonStatus, setHackathonStatus] = useState('draft');

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await apiRequest<{ data: HackathonSettings }>(`/api/v1/hackathons/${slug}`);
        const h = res.data;
        setName(h.title ?? '');
        setTagline(h.tagline ?? '');
        setMinTeamSize(String(h.min_team_size ?? 1));
        setMaxTeamSize(String(h.max_team_size ?? 5));
        setStartsAt(h.starts_at ? h.starts_at.slice(0, 16) : '');
        setSubDeadline(h.judging_starts ? h.judging_starts.slice(0, 16) : '');
        setRequireApproval(h.registration_mode === 'approval');
        setAllowLateSubmissions(!!h.allow_resubmission);
        setHackathonStatus(h.status);
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleSave = async () => {
    if (!slug) return;
    setSaving(true);
    try {
      await apiRequest(`/api/v1/hackathons/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: name,
          tagline,
          min_team_size: parseInt(minTeamSize),
          max_team_size: parseInt(maxTeamSize),
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          judging_starts: subDeadline ? new Date(subDeadline).toISOString() : null,
          registration_mode: requireApproval ? 'approval' : 'open',
          allow_resubmission: allowLateSubmissions ? 1 : 0,
        }),
      });
      setSaved(true);
      toast.success('Settings saved successfully.');
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!slug) return;
    try {
      await apiRequest(`/api/v1/hackathons/${slug}`, { method: 'DELETE' });
      toast.success('Hackathon deleted.');
      navigate('/dashboard');
    } catch {
      toast.error('Failed to delete hackathon. Only draft hackathons can be deleted.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            className="h-8 w-8 rounded-full border-2 border-white/05 border-t-[#CCFF00]"
          />
          <div className="absolute inset-0 rounded-full blur-sm opacity-40" style={{ background: 'radial-gradient(circle, #CCFF00 0%, transparent 70%)' }} />
        </div>
        <p className="text-[10px] uppercase tracking-widest text-white/20">Loading settings</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure hackathon parameters and preferences."
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={hackathonStatus} />

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving}
              className="relative flex items-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50 transition-all"
              style={{
                background: saved
                  ? 'linear-gradient(135deg, #7FFF00, #5fcc00)'
                  : 'linear-gradient(135deg, #CCFF00, #b8e600)',
                boxShadow: '0 0 20px rgba(204,255,0,0.2)',
              }}
            >
              {/* Shimmer */}
              <motion.div
                className="absolute inset-0 -skew-x-12 bg-white/20"
                initial={{ x: '-100%' }}
                animate={saved ? { x: '200%' } : { x: '-100%' }}
                transition={{ duration: 0.5 }}
              />
              <AnimatePresence mode="wait">
                {saving ? (
                  <motion.div
                    key="spinner"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="h-4 w-4 rounded-full border-2 border-black/20 border-t-black"
                    />
                    <span>Saving...</span>
                  </motion.div>
                ) : saved ? (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    <span>Saved!</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="save"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Changes</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        }
      />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">

        {/* ── General ─────────────────────────────────────────────────── */}
        <SettingsSection title="General" icon={Settings} accent="#CCFF00">
          <div className="space-y-4">
            <InputField label="Hackathon Name" value={name} onChange={setName} placeholder="My Epic Hackathon" />
            <InputField label="Tagline" value={tagline} onChange={setTagline} placeholder="Short, punchy description..." />
          </div>
        </SettingsSection>

        {/* ── Dates ────────────────────────────────────────────────────── */}
        <SettingsSection title="Dates & Deadlines" icon={Calendar} accent="#60A5FA">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Starts At" value={startsAt} onChange={setStartsAt} type="datetime-local" />
            <InputField label="Judging Starts" value={subDeadline} onChange={setSubDeadline} type="datetime-local" />
          </div>
          {startsAt && subDeadline && new Date(subDeadline) > new Date(startsAt) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 rounded-lg border border-[#60A5FA]/15 bg-[#60A5FA]/05 px-3 py-2.5"
            >
              <Zap className="h-3.5 w-3.5 text-[#60A5FA]/60 shrink-0" />
              <p className="text-[11px] text-white/40">
                Duration:{' '}
                <span className="text-white/60 font-medium">
                  {Math.round((new Date(subDeadline).getTime() - new Date(startsAt).getTime()) / 3600000)} hours
                </span>
              </p>
            </motion.div>
          )}
        </SettingsSection>

        {/* ── Teams ────────────────────────────────────────────────────── */}
        <SettingsSection title="Team Configuration" icon={Users} accent="#A78BFA">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Min Team Size" value={minTeamSize} onChange={setMinTeamSize} type="number" />
            <InputField label="Max Team Size" value={maxTeamSize} onChange={setMaxTeamSize} type="number" />
          </div>
          {minTeamSize && maxTeamSize && (
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 relative h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                <motion.div
                  className="absolute left-0 top-0 h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #A78BFA, #7C3AED)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(parseInt(maxTeamSize) / 10) * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <span className="text-[10px] text-white/25 shrink-0">
                {minTeamSize}–{maxTeamSize} members
              </span>
            </div>
          )}
        </SettingsSection>

        {/* ── Visibility ───────────────────────────────────────────────── */}
        <SettingsSection title="Visibility & Access" icon={Globe} accent="#34D399">
          <div className="space-y-1">
            <ToggleField
              label="Public listing"
              description="Show this hackathon on the public directory."
              checked={publicListing}
              onChange={setPublicListing}
            />
            <div className="my-1 h-px bg-white/[0.04] mx-3" />
            <ToggleField
              label="Require approval"
              description="Manually approve team registrations before they can join."
              checked={requireApproval}
              onChange={setRequireApproval}
            />
            <div className="my-1 h-px bg-white/[0.04] mx-3" />
            <ToggleField
              label="Allow late submissions"
              description="Accept submissions after the deadline has passed."
              checked={allowLateSubmissions}
              onChange={setAllowLateSubmissions}
            />
          </div>
        </SettingsSection>

        {/* ── Danger Zone ──────────────────────────────────────────────── */}
        <motion.div
          variants={item}
          className="group relative overflow-hidden rounded-2xl border border-red-500/[0.12] bg-red-950/10 transition-all duration-500 hover:border-red-500/20"
        >
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            style={{ background: 'radial-gradient(ellipse at top right, rgba(239,68,68,0.04) 0%, transparent 60%)' }}
          />

          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/08">
                <AlertTriangle className="h-4 w-4 text-red-400/70" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-400/70">Danger Zone</h3>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white/60">Delete hackathon</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-white/25">
                  Permanent action. All submissions, teams, and data will be destroyed.
                </p>
              </div>

              <AnimatePresence mode="wait">
                {showDeleteConfirm ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.9, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 10 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/40 hover:text-white/60 hover:border-white/15 transition-all"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleDelete}
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 transition-colors"
                      style={{ boxShadow: '0 0 16px rgba(239,68,68,0.25)' }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Confirm Delete
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="delete"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="shrink-0 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/05 px-4 py-2 text-xs font-semibold text-red-400/80 hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
