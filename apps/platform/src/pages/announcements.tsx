import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

interface Announcement {
  id: string;
  title: string;
  content: string;
  pinned: number;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export function AnnouncementsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

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
    <div>
      <PageHeader
        title="Announcements"
        description="Broadcast updates to all participants."
        actions={
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 rounded-xl bg-[#CCFF00] px-5 py-2.5 text-sm font-bold text-black transition-shadow hover:shadow-[0_0_24px_rgba(204,255,0,0.25)]"
          >
            <Plus className="h-4 w-4" /> New Announcement
          </motion.button>
        }
      />

      {/* Compose overlay */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="mb-8 rounded-2xl border border-[#CCFF00]/15 bg-[#CCFF00]/3 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white/80">Compose Announcement</h3>
              <button onClick={() => setShowCompose(false)} className="text-white/25 hover:text-white/60 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-3 w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#CCFF00]/30 transition-colors"
            />
            <textarea
              placeholder="Write your announcement..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="mb-4 w-full resize-none rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#CCFF00]/30 transition-colors"
            />
            <div className="flex justify-end">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSend}
                className="flex items-center gap-2 rounded-xl bg-[#CCFF00] px-5 py-2.5 text-sm font-bold text-black"
              >
                <Send className="h-4 w-4" /> Publish
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-6 w-6 rounded-full border-2 border-white/10 border-t-[#CCFF00]"
          />
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Publish your first announcement to reach all participants."
          action={{ label: 'Create Announcement', onClick: () => setShowCompose(true) }}
        />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
          {/* Pinned */}
          {pinned.map((a) => (
            <motion.div
              key={a.id}
              variants={item}
              className="group relative rounded-2xl border border-[#CCFF00]/15 bg-[#CCFF00]/3 p-5 transition-all duration-300 hover:bg-[#CCFF00]/5"
            >
              <button
                onClick={() => handleDelete(a.id)}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400"
                title="Delete announcement"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#CCFF00]/10">
                  <Pin className="h-4 w-4 text-[#CCFF00]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white/80">{a.title}</h3>
                    <span className="rounded-full bg-[#CCFF00]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#CCFF00]">
                      Pinned
                    </span>
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed mb-2">{a.content}</p>
                  <div className="flex items-center gap-3 text-[10px] text-white/20">
                    <span>{a.author_name ?? 'Organizer'}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Regular */}
          {regular.map((a) => (
            <motion.div
              key={a.id}
              variants={item}
              className="group relative rounded-2xl border border-white/6 bg-white/2 p-5 transition-all duration-300 hover:border-white/10 hover:bg-white/4"
            >
              <button
                onClick={() => handleDelete(a.id)}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400"
                title="Delete announcement"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/4">
                  <Megaphone className="h-4 w-4 text-white/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white/80 mb-1">{a.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed mb-2">{a.content}</p>
                  <div className="flex items-center gap-3 text-[10px] text-white/20">
                    <span>{a.author_name ?? 'Organizer'}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
