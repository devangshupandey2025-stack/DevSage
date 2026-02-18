import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { PageHeader, EmptyState } from '@/components/common';
import { apiRequest } from '@/lib/api';
import {
  Megaphone,
  Pin,
  Clock,
  Send,
  Plus,
  X,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Announcement {
  id: string;
  title: string;
  content: string;
  pinned: number;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
}

// ─── Scramble hook ────────────────────────────────────────────────────────────
function useScramble(text: string, trigger: boolean) {
  const [display, setDisplay] = useState(text);
  const chars = '!<>-_\\/[]{}—=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ01';
  useEffect(() => {
    if (!trigger) { setDisplay(text); return; }
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(text.split('').map((char, i) => {
        if (char === ' ') return ' ';
        if (i < iteration) return text[i];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(''));
      if (iteration >= text.length) clearInterval(interval);
      iteration += 0.6;
    }, 25);
    return () => clearInterval(interval);
  }, [trigger, text]);
  return display;
}

// ─── Magnetic hook ────────────────────────────────────────────────────────────
function useMagnetic(strength = 0.4) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });

  const onMove = useCallback((e: MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * strength);
    y.set((e.clientY - rect.top - rect.height / 2) * strength);
  }, [strength, x, y]);

  const onLeave = useCallback(() => { x.set(0); y.set(0); }, [x, y]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, [onMove, onLeave]);

  return { ref, x: sx, y: sy };
}

// ─── Compose Panel ────────────────────────────────────────────────────────────
function ComposePanel({
  title, setTitle, content, setContent, onSend, onClose,
}: {
  title: string; setTitle: (v: string) => void;
  content: string; setContent: (v: string) => void;
  onSend: () => void; onClose: () => void;
}) {
  const [titleFocused, setTitleFocused] = useState(false);
  const [contentFocused, setContentFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { ref, x, y } = useMagnetic(0.4);
  const scrambled = useScramble('PUBLISH', hovered);

  const titleLineX = useMotionValue(0);
  const titleSpring = useSpring(titleLineX, { stiffness: 300, damping: 30 });
  const titleScaleX = useTransform(titleSpring, [0, 100], [0, 1]);
  const contentLineX = useMotionValue(0);
  const contentSpring = useSpring(contentLineX, { stiffness: 300, damping: 30 });
  const contentScaleX = useTransform(contentSpring, [0, 100], [0, 1]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(8px)' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mb-10 relative"
    >
      {/* Top sweep line */}
      <motion.div
        className="absolute top-0 left-0 h-px w-full origin-left"
        style={{ background: 'linear-gradient(90deg, #CCFF00, transparent)' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />

      <div className="pt-6 pb-8 grid grid-cols-[160px_1fr] gap-8 border-t border-[#CCFF00]/20">
        {/* Label col */}
        <div className="flex flex-col gap-2 pt-1">
          <span className="font-mono text-[10px] font-black tracking-[0.25em] uppercase" style={{ color: '#CCFF00' }}>
            COMPOSE
          </span>
          <button
            onClick={onClose}
            className="mt-1 flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase transition-colors w-fit"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
          >
            <X className="h-2.5 w-2.5" /> CLOSE
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-7">
          {/* Title */}
          <div>
            <label
              className="mb-2 block font-mono text-[9px] font-black tracking-[0.3em] uppercase transition-colors duration-200"
              style={{ color: titleFocused ? '#CCFF00' : 'rgba(255,255,255,0.2)' }}
            >
              TITLE
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Announcement title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={() => { setTitleFocused(true); titleLineX.set(100); }}
                onBlur={() => { setTitleFocused(false); titleLineX.set(0); }}
                className="w-full bg-transparent pb-3 pt-1 text-sm text-white/80 placeholder:text-white/10 outline-none border-0"
                style={{ caretColor: '#CCFF00' }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.07]" />
              <motion.div
                className="absolute bottom-0 left-0 h-px w-full origin-left"
                style={{
                  scaleX: titleScaleX,
                  background: 'linear-gradient(90deg, #CCFF00, #a3d400)',
                  boxShadow: titleFocused ? '0 0 8px rgba(204,255,0,0.6)' : 'none',
                }}
              />
            </div>
          </div>

          {/* Content */}
          <div>
            <label
              className="mb-2 block font-mono text-[9px] font-black tracking-[0.3em] uppercase transition-colors duration-200"
              style={{ color: contentFocused ? '#CCFF00' : 'rgba(255,255,255,0.2)' }}
            >
              MESSAGE
            </label>
            <div className="relative">
              <textarea
                placeholder="Write your announcement..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={() => { setContentFocused(true); contentLineX.set(100); }}
                onBlur={() => { setContentFocused(false); contentLineX.set(0); }}
                rows={4}
                className="w-full resize-none bg-transparent pb-3 pt-1 text-sm text-white/80 placeholder:text-white/10 outline-none border-0 leading-relaxed"
                style={{ caretColor: '#CCFF00' }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.07]" />
              <motion.div
                className="absolute bottom-0 left-0 h-px w-full origin-left"
                style={{
                  scaleX: contentScaleX,
                  background: 'linear-gradient(90deg, #CCFF00, #a3d400)',
                  boxShadow: contentFocused ? '0 0 8px rgba(204,255,0,0.6)' : 'none',
                }}
              />
            </div>
          </div>

          {/* Send */}
          <div className="flex justify-start pt-1">
            <div ref={ref} className="inline-block">
              <motion.button
                style={{ x, y }}
                onHoverStart={() => setHovered(true)}
                onHoverEnd={() => setHovered(false)}
                onClick={onSend}
                whileTap={{ scale: 0.95 }}
                className="relative overflow-hidden px-7 py-3 font-mono text-[11px] font-black tracking-[0.25em] uppercase flex items-center gap-2.5"
                animate={{
                  background: hovered ? '#CCFF00' : 'transparent',
                  color: hovered ? '#000' : '#CCFF00',
                  boxShadow: hovered ? '0 0 40px rgba(204,255,0,0.3)' : 'none',
                }}
                style={{ border: '1px solid #CCFF00' }}
                transition={{ duration: 0.2 }}
              >
                {/* Scan line */}
                <motion.div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(204,255,0,0.07) 50%, transparent 100%)', height: '40%' }}
                  animate={{ top: ['-40%', '140%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                />
                <Send className="h-3 w-3 relative" />
                <span className="relative">{scrambled}</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom rule */}
      <motion.div
        className="h-px"
        style={{ background: 'linear-gradient(90deg, rgba(204,255,0,0.15), transparent)' }}
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.7, delay: 0.2 }}
      />
    </motion.div>
  );
}

// ─── Announcement Card ────────────────────────────────────────────────────────
function AnnouncementCard({
  announcement,
  index,
  onDelete,
}: {
  announcement: Announcement;
  index: number;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPinned = announcement.pinned === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative border-t border-white/[0.07] group"
    >
      {/* Hover sweep */}
      <motion.div
        className="absolute top-0 left-0 h-px w-full origin-left"
        style={{
          background: isPinned
            ? 'linear-gradient(90deg, #CCFF00, transparent)'
            : 'linear-gradient(90deg, rgba(255,255,255,0.15), transparent)',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: hovered ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      />

      <div className="py-7 grid grid-cols-[160px_1fr] gap-8">
        {/* Meta col */}
        <div className="flex flex-col gap-2 pt-1">
          {isPinned ? (
            <div className="flex items-center gap-1.5">
              <motion.div
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              >
                <Pin className="h-3 w-3" style={{ color: '#CCFF00' }} />
              </motion.div>
              <span className="font-mono text-[9px] font-black tracking-[0.25em] uppercase" style={{ color: '#CCFF00' }}>
                PINNED
              </span>
            </div>
          ) : (
            <span className="font-mono text-[9px] font-black tracking-[0.25em] uppercase" style={{ color: 'rgba(255,255,255,0.15)' }}>
              UPDATE
            </span>
          )}

          <div className="flex items-center gap-1 mt-1" style={{ color: 'rgba(255,255,255,0.18)' }}>
            <Clock className="h-2.5 w-2.5" />
            <span className="font-mono text-[9px]">
              {new Date(announcement.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric',
              })}
            </span>
          </div>
          <span className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.12)' }}>
            {new Date(announcement.created_at).toLocaleTimeString('en-US', {
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>

        {/* Content col */}
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h3
              className="text-base font-bold leading-snug transition-colors duration-200"
              style={{ color: hovered ? '#fff' : 'rgba(255,255,255,0.75)' }}
            >
              {announcement.title}
            </h3>

            {/* Delete controls */}
            <AnimatePresence mode="wait">
              {confirmDelete ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2 shrink-0"
                >
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 border border-white/[0.07] transition-colors"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                  >
                    ABORT
                  </button>
                  <motion.button
                    whileHover={{ boxShadow: '0 0 20px rgba(239,68,68,0.4)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onDelete(announcement.id)}
                    className="font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 font-black text-black"
                    style={{ background: '#ef4444' }}
                  >
                    DELETE
                  </motion.button>
                </motion.div>
              ) : (
                <motion.button
                  key="trash"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: hovered ? 1 : 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setConfirmDelete(true)}
                  whileHover={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                  className="shrink-0 flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 border transition-all"
                  style={{ color: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.07)' }}
                >
                  <Trash2 className="h-3 w-3" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {announcement.content}
          </p>

          <div className="mt-4 flex items-center gap-3 font-mono text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.18)' }}>
            <span>{(announcement.author_name ?? 'Organizer').toUpperCase()}</span>
            <div className="h-px w-6 bg-white/[0.08]" />
            <span style={{ color: isPinned ? 'rgba(204,255,0,0.4)' : 'rgba(255,255,255,0.12)' }}>
              {isPinned ? 'PINNED POST' : 'BROADCAST'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── New Announcement Button ──────────────────────────────────────────────────
function NewButton({ onClick }: { onClick: () => void }) {
  const { ref, x, y } = useMagnetic(0.4);
  const [hovered, setHovered] = useState(false);
  const scrambled = useScramble('NEW ANNOUNCEMENT', hovered);

  return (
    <div ref={ref} className="inline-block">
      <motion.button
        style={{ x, y }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onClick={onClick}
        whileTap={{ scale: 0.95 }}
        className="relative overflow-hidden px-6 py-2.5 font-mono text-[11px] font-black tracking-[0.2em] uppercase flex items-center gap-2.5"
        animate={{
          background: hovered ? '#CCFF00' : 'transparent',
          color: hovered ? '#000' : '#CCFF00',
          boxShadow: hovered ? '0 0 40px rgba(204,255,0,0.3)' : 'none',
        }}
        style={{ border: '1px solid #CCFF00' }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(204,255,0,0.07) 50%, transparent 100%)', height: '40%' }}
          animate={{ top: ['-40%', '140%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
        />
        <Plus className="h-3.5 w-3.5 relative" />
        <span className="relative">{scrambled}</span>
      </motion.button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AnnouncementsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // Cursor glow
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
    fetchAnnouncements();
  }, [slug]);

  const fetchAnnouncements = async () => {
    try {
      const res = await apiRequest<{ data: Announcement[]; ok: boolean }>(`/api/v1/hackathons/${slug}/announcements`);
      console.log('[announcements] Fetch result:', { ok: res.ok, count: res.data?.length ?? 0, data: res.data });
      setAnnouncements(res.data ?? []);
    } catch (_err) {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !content.trim() || !slug) {
      toast.error('Please fill in both title and content.');
      return;
    }
    try {
      const res = await apiRequest<{ data: unknown; ok: boolean }>(`/api/v1/hackathons/${slug}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });
      console.log('[announcements] Create result:', res);
      toast.success('Announcement published!');
      setShowCompose(false);
      setTitle('');
      setContent('');
      fetchAnnouncements();
    } catch (_err) {
      toast.error('Failed to publish announcement. Make sure you have organizer permissions.');
    }
  };

  const handleDelete = async (announcementId: string) => {
    if (!slug || !confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/announcements/${announcementId}`, {
        method: 'DELETE',
      });
      toast.success('Announcement deleted');
      fetchAnnouncements();
    } catch (_err) {
      toast.error('Failed to delete announcement');
    }
  };

  const pinned = announcements.filter((a) => a.pinned === 1);
  const regular = announcements.filter((a) => a.pinned !== 1);

  return (
    <div className="relative">
      {/* Ambient cursor glow */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: cursorGlow,
        }}
      />

      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '180px',
        }}
      />

      <div className="relative z-10">
        <PageHeader
          title="Announcements"
          description="Broadcast updates to all participants."
          actions={<NewButton onClick={() => setShowCompose(true)} />}
        />

        {/* Compose panel */}
        <AnimatePresence>
          {showCompose && (
            <ComposePanel
              title={title}
              setTitle={setTitle}
              content={content}
              setContent={setContent}
              onSend={handleSend}
              onClose={() => setShowCompose(false)}
            />
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
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
              LOADING FEED
            </motion.p>
          </div>
        ) : announcements.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              description="Publish your first announcement to reach all participants."
              action={{ label: 'Create Announcement', onClick: () => setShowCompose(true) }}
            />
          </motion.div>
        ) : (
          <div>
            {/* Pinned section */}
            {pinned.length > 0 && (
              <div className="mb-2">
                {pinned.map((a, i) => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    index={i}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {/* Divider between pinned and regular */}
            {pinned.length > 0 && regular.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="my-2 flex items-center gap-4 font-mono text-[9px] tracking-[0.3em] uppercase"
                style={{ color: 'rgba(255,255,255,0.12)' }}
              >
                <div className="h-px flex-1 bg-white/[0.05]" />
                RECENT
                <div className="h-px flex-1 bg-white/[0.05]" />
              </motion.div>
            )}

            {/* Regular */}
            {regular.map((a, i) => (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                index={pinned.length + i}
                onDelete={handleDelete}
              />
            ))}

            {/* Bottom rule */}
            <motion.div
              className="mt-2 h-px"
              style={{ background: 'linear-gradient(90deg, rgba(204,255,0,0.15), transparent)' }}
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.2, delay: 0.4 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
