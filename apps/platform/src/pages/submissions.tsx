import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { PageHeader, EmptyState, StatusBadge } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  FileCode,
  Search,
  GitCommit,
  Tag,
  Clock,
  ExternalLink,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface Submission {
  id: string;
  team_id: string;
  team_name: string;
  tag_name: string;
  commit_sha: string;
  repo_url: string;
  status: string;
  submitted_at: string;
  artifacts?: string[];
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export function SubmissionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!slug) return;
    fetchSubmissions();
  }, [slug]);

  const fetchSubmissions = async () => {
    try {
      const res = await apiRequest<{ data: Submission[] }>(`/api/v1/hackathons/${slug}/submissions`);
      setSubmissions(res.data ?? []);
    } catch (_err) {
      // Graceful — submissions endpoint might not exist yet
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = submissions.filter(
    (s) =>
      s.team_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.tag_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Submissions"
        description={`${submissions.length} submissions captured`}
        actions={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search submissions..."
              className="pl-9 border-white/[0.08] bg-white/[0.03] text-white placeholder:text-white/20 w-56"
            />
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`s-${String(i)}`} className="h-20 bg-white/[0.06] rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileCode}
          title={search ? 'No submissions match your search' : 'No submissions yet'}
          description="Submissions are captured automatically when participants push git tags. They'll appear here in real-time."
        />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
          {filtered.map((submission) => (
            <motion.div
              key={submission.id}
              variants={item}
              className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
            >
              {/* Status icon */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                submission.status === 'validated' ? 'bg-emerald-500/10 text-emerald-400' :
                submission.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                'bg-sky-500/10 text-sky-400'
              }`}>
                {submission.status === 'validated' ? <CheckCircle className="h-5 w-5" /> :
                 submission.status === 'rejected' ? <AlertCircle className="h-5 w-5" /> :
                 <FileCode className="h-5 w-5" />}
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white/80 group-hover:text-white transition-colors truncate">
                    {submission.team_name}
                  </h3>
                  <span className="flex items-center gap-1 rounded-full bg-[#CCFF00]/10 px-2 py-0.5 text-[10px] font-semibold text-[#CCFF00]">
                    <Tag className="h-2.5 w-2.5" /> {submission.tag_name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/25">
                  <span className="flex items-center gap-1 font-mono">
                    <GitCommit className="h-3 w-3" /> {submission.commit_sha?.slice(0, 7)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(submission.submitted_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {submission.repo_url && (
                  <a
                    href={submission.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/25 transition hover:bg-white/[0.08] hover:text-white/50"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
