import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader, EmptyState } from '@/components/common';
import {
  Megaphone,
  Pin,
  Clock,
  Send,
  Plus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  created_at: string;
  author: { display_name: string; avatar_url?: string };
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
    // Simulated data load
    setTimeout(() => {
      setAnnouncements([
        {
          id: '1',
          title: 'Submission deadline extended!',
          content: 'We have extended the submission deadline by 24 hours due to popular request. New deadline is March 20th, 11:59 PM UTC.',
          pinned: true,
          created_at: '2026-03-14T10:30:00Z',
          author: { display_name: 'Sarah Chen' },
        },
        {
          id: '2',
          title: 'Workshop: Building with AI APIs',
          content: 'Join us tomorrow at 3 PM UTC for a hands-on workshop on integrating AI APIs into your hackathon projects.',
          pinned: false,
          created_at: '2026-03-13T15:00:00Z',
          author: { display_name: 'Alex Rivera' },
        },
        {
          id: '3',
          title: 'Welcome to DevSage Hackathon 2026!',
          content: 'We are excited to kick off this year\'s hackathon. Please make sure to read the rules and guidelines before starting.',
          pinned: false,
          created_at: '2026-03-10T09:00:00Z',
          author: { display_name: 'Sarah Chen' },
        },
      ]);
      setLoading(false);
    }, 600);
  }, [slug]);

  const handleSend = () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Please fill in both title and content.');
      return;
    }
    toast.success('Announcement published!');
    setShowCompose(false);
    setTitle('');
    setContent('');
  };

  const pinned = announcements.filter((a) => a.pinned);
  const regular = announcements.filter((a) => !a.pinned);

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
            className="mb-8 rounded-2xl border border-[#CCFF00]/15 bg-[#CCFF00]/[0.03] p-6"
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
              className="mb-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#CCFF00]/30 transition-colors"
            />
            <textarea
              placeholder="Write your announcement..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="mb-4 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#CCFF00]/30 transition-colors"
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
              className="group relative rounded-2xl border border-[#CCFF00]/15 bg-[#CCFF00]/[0.03] p-5 transition-all duration-300 hover:bg-[#CCFF00]/[0.05]"
            >
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
                    <span>{a.author.display_name}</span>
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
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.04]"
            >
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                  <Megaphone className="h-4 w-4 text-white/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white/80 mb-1">{a.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed mb-2">{a.content}</p>
                  <div className="flex items-center gap-3 text-[10px] text-white/20">
                    <span>{a.author.display_name}</span>
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
