import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { PageHeader } from '@/components/common';
import {
  Settings,
  Save,
  Calendar,
  Users,
  Globe,
  Trash2,
  AlertTriangle,
  Check,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';

// ─── Magnetic cursor hook ─────────────────────────────────────────────────────
function useMagnetic(strength = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });

  const onMove = useCallback((e: MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * strength);
    y.set((e.clientY - cy) * strength);
  }, [strength, x, y]);

  const onLeave = useCallback(() => {
    x.set(0); y.set(0);
  }, [x, y]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [onMove, onLeave]);

  return { ref, x: sx, y: sy };
}

// ─── Scramble text hook ───────────────────────────────────────────────────────
function useScramble(text: string, trigger: boolean) {
  const [display, setDisplay] = useState(text);
  const chars = '!<>-_\\/[]{}—=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ01';

  useEffect(() => {
    if (!trigger) { setDisplay(text); return; }
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(
        text.split('').map((char, i) => {
          if (char === ' ') return ' ';
          if (i < iteration) return text[i];
          return chars[Math.floor(Math.random() * chars.length)];
        }).join('')
      );
      if (iteration >= text.length) clearInterval(interval);
      iteration += 0.6;
    }, 25);
    return () => clearInterval(interval);
  }, [trigger, text]);

  return display;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface HackathonSettings {
  title: string;
  tagline: string | null;
  min_team_size: number;
  max_team_size: number;
  starts_at: string | null;
  submission_deadline: string | null;
  registration_mode: string | null;
  allow_resubmission: boolean;
  status: string;
}

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({
  label,
  index,
  children,
}: {
  label: string;
  index: number;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const scrambled = useScramble(label.toUpperCase(), hovered);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.09, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative border-t border-white/[0.07] group"
    >
      {/* Sweep line on hover */}
      <motion.div
        className="absolute top-0 left-0 h-px w-full origin-left"
        style={{ background: 'linear-gradient(90deg, #CCFF00, transparent)' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: hovered ? 1 : 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />

      <div className="grid grid-cols-[160px_1fr] gap-8 py-8">
        {/* Label col */}
        <div className="flex flex-col gap-2 pt-1">
          <span
            className="text-[10px] font-black tracking-[0.25em] transition-colors duration-300 font-mono"
            style={{ color: hovered ? '#CCFF00' : 'rgba(255,255,255,0.2)' }}
          >
            {scrambled}
          </span>
          <span className="font-mono text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.08)' }}>
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        {/* Content col */}
        <div>{children}</div>
      </div>
    </motion.div>
  );
}

// ─── Raw Input ────────────────────────────────────────────────────────────────
function RawInput({
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
  const lineWidth = useMotionValue(0);
  const springWidth = useSpring(lineWidth, { stiffness: 300, damping: 30 });
  const scaleX = useTransform(springWidth, [0, 100], [0, 1]);

  return (
    <div>
      <label
        className="mb-2 block text-[9px] font-black tracking-[0.3em] uppercase font-mono transition-colors duration-200"
        style={{ color: focused ? '#CCFF00' : 'rgba(255,255,255,0.2)' }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { setFocused(true); lineWidth.set(100); }}
          onBlur={() => { setFocused(false); lineWidth.set(0); }}
          placeholder={placeholder}
          className="w-full bg-transparent pb-3 pt-1 text-sm text-white/80 placeholder:text-white/10 outline-none border-0"
          style={{ caretColor: '#CCFF00' }}
        />
        {/* Track */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.07]" />
        {/* Active line */}
        <motion.div
          className="absolute bottom-0 left-0 h-px w-full origin-left"
          style={{
            scaleX,
            background: 'linear-gradient(90deg, #CCFF00, #a3d400)',
            boxShadow: focused ? '0 0 8px rgba(204,255,0,0.6)' : 'none',
          }}
        />
      </div>
    </div>
  );
}

// ─── Slash Toggle ─────────────────────────────────────────────────────────────
function SlashToggle({
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
  const [hovered, setHovered] = useState(false);
  const scrambled = useScramble(checked ? 'ENABLED' : 'DISABLED', hovered);

  return (
    <motion.div
      className="flex cursor-pointer items-center justify-between py-4 border-b border-white/[0.04] last:border-0"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => onChange(!checked)}
      whileTap={{ scale: 0.995 }}
    >
      <div className="flex items-center gap-4">
        {/* Animated slash marks */}
        <div className="flex items-center gap-0.5 shrink-0">
          <motion.div
            className="h-4 w-[2px] rounded-full"
            style={{ background: checked ? '#CCFF00' : 'rgba(255,255,255,0.12)' }}
            animate={{
              rotate: checked ? -25 : 25,
              boxShadow: checked ? '0 0 6px #CCFF00' : 'none',
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          />
          <motion.div
            className="h-4 w-[2px] rounded-full"
            style={{ background: checked ? '#CCFF00' : 'rgba(255,255,255,0.12)' }}
            animate={{
              rotate: checked ? 25 : -25,
              boxShadow: checked ? '0 0 6px #CCFF00' : 'none',
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          />
        </div>

        <div>
          <p
            className="text-sm font-semibold transition-colors duration-200"
            style={{ color: hovered ? '#fff' : 'rgba(255,255,255,0.6)' }}
          >
            {label}
          </p>
          <p className="mt-0.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {description}
          </p>
        </div>
      </div>

      {/* Status pill */}
      <motion.div
        className="shrink-0 font-mono text-[9px] font-black tracking-[0.25em] uppercase px-3 py-1.5"
        animate={{
          background: checked ? 'rgba(204,255,0,0.1)' : 'rgba(255,255,255,0.03)',
          color: checked ? '#CCFF00' : 'rgba(255,255,255,0.2)',
          borderColor: checked ? 'rgba(204,255,0,0.25)' : 'rgba(255,255,255,0.07)',
          boxShadow: checked ? '0 0 12px rgba(204,255,0,0.15)' : 'none',
        }}
        style={{ border: '1px solid' }}
        transition={{ duration: 0.2 }}
      >
        {scrambled}
      </motion.div>
    </motion.div>
  );
}

// ─── Magnetic Save Button ─────────────────────────────────────────────────────
function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  const { ref, x, y } = useMagnetic(0.45);
  const [hovered, setHovered] = useState(false);
  const label = saved ? 'SAVED' : saving ? 'SAVING' : 'SAVE CHANGES';
  const scrambled = useScramble(label, hovered && !saving && !saved);

  return (
    <div ref={ref} className="inline-block">
      <motion.button
        style={{ x, y }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onClick={onClick}
        disabled={saving}
        whileTap={{ scale: 0.95 }}
        className="relative overflow-hidden px-7 py-3 font-mono text-[11px] font-black tracking-[0.25em] uppercase disabled:opacity-50"
        animate={{
          background: saved ? '#CCFF00' : hovered ? '#CCFF00' : 'transparent',
          color: saved || hovered ? '#000' : '#CCFF00',
          borderColor: '#CCFF00',
          boxShadow: hovered
            ? '0 0 40px rgba(204,255,0,0.35), inset 0 0 30px rgba(204,255,0,0.08)'
            : saved
            ? '0 0 30px rgba(204,255,0,0.5)'
            : '0 0 0px rgba(204,255,0,0)',
        }}
        transition={{ duration: 0.25 }}
      >
        {/* Scan line */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(204,255,0,0.07) 50%, transparent 100%)',
            height: '40%',
          }}
          animate={{ top: ['-40%', '140%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 0.8 }}
        />

        <div className="relative flex items-center gap-2.5">
          <AnimatePresence mode="wait">
            {saving ? (
              <motion.div key="spin" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                  className="h-3 w-3 rounded-full border border-current border-t-transparent"
                />
              </motion.div>
            ) : saved ? (
              <motion.div key="check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500 }}>
                <Check className="h-3 w-3" />
              </motion.div>
            ) : (
              <motion.div key="zap" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <Zap className="h-3 w-3" />
              </motion.div>
            )}
          </AnimatePresence>
          <span>{scrambled}</span>
        </div>
      </motion.button>
    </div>
  );
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

  // Global cursor glow
  const cursorX = useMotionValue(-200);
  const cursorY = useMotionValue(-200);
  const springCX = useSpring(cursorX, { stiffness: 80, damping: 20 });
  const springCY = useSpring(cursorY, { stiffness: 80, damping: 20 });
  const cursorGlow = useTransform(
    [springCX, springCY],
    ([x, y]: number[]) =>
      `radial-gradient(700px circle at ${x}px ${y}px, rgba(204,255,0,0.025), transparent 55%)`
  );

  useEffect(() => {
    const move = (e: MouseEvent) => { cursorX.set(e.clientX); cursorY.set(e.clientY); };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

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
        setSubDeadline(h.submission_deadline ? h.submission_deadline.slice(0, 16) : '');
        setRequireApproval(h.registration_mode === 'approval');
        setAllowLateSubmissions(h.allow_resubmission ?? false);
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
          registration_mode: requireApproval ? 'approval' : 'open',
          allow_resubmission: allowLateSubmissions,
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
      <div className="flex flex-col items-center justify-center py-40 gap-5">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-8 w-8 rounded-full border border-white/10 border-t-[#CCFF00]"
          />
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ opacity: [0.3, 0.9, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ boxShadow: '0 0 24px #CCFF00' }}
          />
        </div>
        <motion.p
          className="font-mono text-[9px] tracking-[0.4em] uppercase"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          LOADING CONFIG
        </motion.p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Ambient cursor glow */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: cursorGlow,
        }}
      />

      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '180px',
        }}
      />

      <div className="relative z-10">
        <PageHeader
          title="Settings"
          description="Configure hackathon parameters and preferences."
          actions={
            <div className="flex items-center gap-4">
              {/* Status indicator */}
              <div
                className="flex items-center gap-2 font-mono text-[9px] font-black tracking-[0.3em] uppercase px-3 py-2"
                style={{
                  color: hackathonStatus === 'active' ? '#CCFF00' : 'rgba(255,255,255,0.2)',
                  border: `1px solid ${hackathonStatus === 'active' ? 'rgba(204,255,0,0.25)' : 'rgba(255,255,255,0.07)'}`,
                }}
              >
                {hackathonStatus === 'active' && (
                  <motion.span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[#CCFF00]"
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}
                {hackathonStatus.toUpperCase()}
              </div>

              <SaveButton saving={saving} saved={saved} onClick={handleSave} />
            </div>
          }
        />

        {/* ── Content ── */}
        <div className="mt-2">
          <Section label="General" index={0}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-7">
              <RawInput label="Hackathon Name" value={name} onChange={setName} placeholder="Untitled Hackathon" />
              <RawInput label="Tagline" value={tagline} onChange={setTagline} placeholder="Short, punchy description..." />
            </div>
          </Section>

          <Section label="Dates & Deadlines" index={1}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-7">
              <RawInput label="Starts At" value={startsAt} onChange={setStartsAt} type="datetime-local" />
              <RawInput label="Submission Deadline" value={subDeadline} onChange={setSubDeadline} type="datetime-local" />
            </div>
            <AnimatePresence>
              {startsAt && subDeadline && new Date(subDeadline) > new Date(startsAt) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-7"
                >
                  <div className="flex items-center gap-3 font-mono text-[10px] tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    <span className="font-black" style={{ color: '#CCFF00' }}>
                      {Math.round((new Date(subDeadline).getTime() - new Date(startsAt).getTime()) / 3600000)}H
                    </span>
                    <motion.div
                      className="h-px flex-1"
                      style={{ background: 'linear-gradient(90deg, rgba(204,255,0,0.2), transparent)' }}
                      initial={{ scaleX: 0, originX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                    <span>DURATION</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Section>

          <Section label="Team Configuration" index={2}>
            <div className="grid grid-cols-2 gap-x-12 gap-y-7 max-w-xs">
              <RawInput label="Min Size" value={minTeamSize} onChange={setMinTeamSize} type="number" />
              <RawInput label="Max Size" value={maxTeamSize} onChange={setMaxTeamSize} type="number" />
            </div>
            {minTeamSize && maxTeamSize && (
              <div className="mt-7 flex items-center gap-4 max-w-xs">
                <div className="relative flex-1 h-px bg-white/[0.06]">
                  <motion.div
                    className="absolute left-0 top-0 h-full"
                    style={{ background: 'linear-gradient(90deg, #CCFF00, rgba(204,255,0,0.25))' }}
                    animate={{ width: `${Math.min((parseInt(maxTeamSize) / 20) * 100, 100)}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-[#CCFF00]"
                    animate={{
                      left: `${Math.min((parseInt(maxTeamSize) / 20) * 100, 100)}%`,
                      boxShadow: '0 0 10px #CCFF00',
                    }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transform: 'translate(-50%, -50%)' }}
                  />
                </div>
                <span className="font-mono text-[9px] tracking-widest shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  {minTeamSize}–{maxTeamSize}
                </span>
              </div>
            )}
          </Section>

          <Section label="Visibility & Access" index={3}>
            <SlashToggle
              label="Public listing"
              description="Show this hackathon on the public directory."
              checked={publicListing}
              onChange={setPublicListing}
            />
            <SlashToggle
              label="Require approval"
              description="Manually approve team registrations."
              checked={requireApproval}
              onChange={setRequireApproval}
            />
            <SlashToggle
              label="Allow late submissions"
              description="Accept submissions after the deadline."
              checked={allowLateSubmissions}
              onChange={setAllowLateSubmissions}
            />
          </Section>

          {/* ── Danger Zone ── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="relative border-t border-red-500/[0.12] group"
          >
            <motion.div
              className="absolute top-0 left-0 h-px w-full origin-left"
              style={{ background: 'linear-gradient(90deg, #ef4444, transparent)' }}
              initial={{ scaleX: 0 }}
              whileHover={{ scaleX: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />

            <div className="grid grid-cols-[160px_1fr] gap-8 py-8">
              <div className="flex flex-col gap-2 pt-1">
                <span className="font-mono text-[10px] font-black tracking-[0.25em] uppercase" style={{ color: 'rgba(239,68,68,0.45)' }}>
                  DANGER
                </span>
                <span className="font-mono text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.06)' }}>
                  05
                </span>
              </div>

              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Delete hackathon
                  </p>
                  <p className="mt-1 font-mono text-[9px] tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.18)' }}>
                    Irreversible — all data destroyed
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  {showDeleteConfirm ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-3 shrink-0"
                    >
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="font-mono text-[10px] tracking-[0.2em] uppercase px-4 py-2 border border-white/[0.07] text-white/25 hover:text-white/50 transition-colors"
                      >
                        ABORT
                      </button>
                      <motion.button
                        whileHover={{ boxShadow: '0 0 30px rgba(239,68,68,0.5)' }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleDelete}
                        className="font-mono text-[10px] tracking-[0.2em] uppercase px-4 py-2 font-black text-black transition-all"
                        style={{ background: '#ef4444' }}
                      >
                        CONFIRM DELETE
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="delete"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      whileHover={{
                        color: '#ef4444',
                        borderColor: 'rgba(239,68,68,0.4)',
                        boxShadow: '0 0 20px rgba(239,68,68,0.15)',
                      }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setShowDeleteConfirm(true)}
                      className="shrink-0 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase px-4 py-2 border font-black"
                      style={{
                        color: 'rgba(239,68,68,0.45)',
                        borderColor: 'rgba(239,68,68,0.15)',
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                      DELETE
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Bottom rule */}
          <motion.div
            className="h-px"
            style={{ background: 'linear-gradient(90deg, rgba(204,255,0,0.2), transparent)' }}
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </div>
  );
}
