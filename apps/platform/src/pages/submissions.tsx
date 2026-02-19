import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/api';
import { PageHeader, EmptyState } from '@/components/common';
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
  ChevronDown,
  ChevronUp,
  Sparkles,
  Star,
  Wrench,
  Cpu,
  Rocket,
} from 'lucide-react';

interface AiReview {
  summary: string;
  score: number;
  strengths: string[];
  improvements: string[];
  tech_stack_assessment: string;
  hackathon_readiness: string;
}

interface RepoAnalysis {
  repository: string;
  owner: string;
  description: string | null;
  primary_language: string | null;
  project_type: string;
  detected_frameworks: string[];
  total_files: number;
  has_dockerfile: boolean;
  has_ci: boolean;
  has_tests: boolean;
  has_readme: boolean;
  stars: number;
  forks: number;
  dependencies: string[];
}

interface Submission {
  id: string;
  team_id: string;
  team_name: string;
  tag_name: string;
  title?: string;
  description?: string;
  commit_sha: string;
  repo_url: string;
  status: string;
  submitted_at: string;
  ai_score?: number | null;
  analysis?: RepoAnalysis;
  ai_review?: AiReview;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

function scoreColorClass(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBgClass(score: number): string {
  if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export function SubmissionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetchSubmissions();
  }, [slug]);

  const fetchSubmissions = async () => {
    try {
      const res = await apiRequest<{ data: Submission[] }>(`/api/v1/hackathons/${slug}/submissions`);
      setSubmissions(res.data ?? []);
    } catch (_err) {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = async (submission: Submission) => {
    if (expandedId === submission.id) {
      setExpandedId(null);
      return;
    }

    const existing = submissions.find(s => s.id === submission.id);
    if (existing?.analysis || existing?.ai_review) {
      setExpandedId(submission.id);
      return;
    }

    setLoadingDetail(submission.id);
    try {
      const res = await apiRequest<{ data: Submission }>(`/api/v1/hackathons/${slug}/submissions/${submission.id}`);
      if (res.data) {
        setSubmissions(prev => prev.map(s => s.id === submission.id ? { ...s, ...res.data } : s));
      }
    } catch { /* keep existing data */ }
    setLoadingDetail(null);
    setExpandedId(submission.id);
  };

  const filtered = submissions.filter(
    (s) =>
      s.team_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.tag_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.title?.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (a.ai_score != null && b.ai_score != null) return b.ai_score - a.ai_score;
    if (a.ai_score != null) return -1;
    if (b.ai_score != null) return 1;
    return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
  });

  return (
    <div>
      <PageHeader
        title="Submissions"
        description={`${submissions.length} submission${submissions.length !== 1 ? 's' : ''} captured`}
        actions={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search submissions..."
              className="pl-9 border-white/8 bg-white/3 text-white placeholder:text-white/20 w-56"
            />
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`s-${String(i)}`} className="h-20 bg-white/6 rounded-2xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={FileCode}
          title={search ? 'No submissions match your search' : 'No submissions yet'}
          description="Submissions will appear here when participants submit their projects."
        />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
          {sorted.map((submission) => (
            <motion.div key={submission.id} variants={item}>
              {/* Main row */}
              <div
                onClick={() => handleExpand(submission)}
                className={`group flex items-center gap-4 border bg-white/2 p-5 transition-all duration-300 cursor-pointer ${
                  expandedId === submission.id
                    ? 'border-white/15 bg-white/4 rounded-t-2xl'
                    : 'border-white/6 hover:border-white/12 hover:bg-white/4 rounded-2xl'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  submission.status === 'validated' ? 'bg-emerald-500/10 text-emerald-400' :
                  submission.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                  'bg-sky-500/10 text-sky-400'
                }`}>
                  {submission.status === 'validated' ? <CheckCircle className="h-5 w-5" /> :
                   submission.status === 'rejected' ? <AlertCircle className="h-5 w-5" /> :
                   <FileCode className="h-5 w-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white/80 group-hover:text-white transition-colors truncate">
                      {submission.team_name}
                    </h3>
                    <span className="flex items-center gap-1 rounded-full bg-[#CCFF00]/10 px-2 py-0.5 text-[10px] font-semibold text-[#CCFF00]">
                      <Tag className="h-2.5 w-2.5" /> {submission.title || submission.tag_name}
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

                {submission.ai_score != null && (
                  <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 ${scoreBgClass(submission.ai_score)}`}>
                    <Sparkles className={`h-3.5 w-3.5 ${scoreColorClass(submission.ai_score)}`} />
                    <span className={`text-sm font-bold ${scoreColorClass(submission.ai_score)}`}>{submission.ai_score}</span>
                    <span className="text-[10px] text-white/25">/100</span>
                  </div>
                )}

                <div className="flex items-center gap-3 shrink-0">
                  <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${
                    expandedId === submission.id
                      ? 'border-[#CCFF00]/30 bg-[#CCFF00]/10 text-[#CCFF00]'
                      : 'border-white/8 bg-white/4 text-white/30 group-hover:border-white/15 group-hover:text-white/50'
                  }`}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {expandedId === submission.id ? 'Collapse' : 'Details'}
                    </span>
                    {expandedId === submission.id
                      ? <ChevronUp className="h-3.5 w-3.5" />
                      : <ChevronDown className="h-3.5 w-3.5" />
                    }
                  </div>
                </div>
              </div>

              {/* Expandable detail panel */}
              <AnimatePresence>
                {expandedId === submission.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden border border-t-0 border-white/15 rounded-b-2xl bg-white/[0.02]"
                  >
                    {loadingDetail === submission.id ? (
                      <div className="p-6 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="p-6 space-y-5">
                        {/* Quick links */}
                        <div className="flex flex-wrap gap-2">
                          {submission.repo_url && (
                            <a
                              href={submission.repo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-medium text-white/50 transition hover:bg-white/8 hover:text-white/70"
                            >
                              <ExternalLink className="h-3 w-3" /> View Repository
                            </a>
                          )}
                        </div>

                        {submission.description && (
                          <div>
                            <p className="text-xs text-white/30 uppercase tracking-widest mb-1.5">Description</p>
                            <p className="text-sm text-white/60 leading-relaxed">{submission.description}</p>
                          </div>
                        )}

                        {submission.ai_review && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-purple-400" />
                              <h4 className="text-xs font-bold uppercase tracking-widest text-purple-300/70">Gemini AI Review</h4>
                              <div className="ml-auto flex items-center gap-1">
                                <span className={`text-2xl font-black ${scoreColorClass(submission.ai_review.score)}`}>
                                  {submission.ai_review.score}
                                </span>
                                <span className="text-xs text-white/20">/100</span>
                              </div>
                            </div>

                            <div className="rounded-xl border border-purple-500/15 bg-purple-500/5 p-4">
                              <p className="text-sm text-white/60 leading-relaxed">{submission.ai_review.summary}</p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4">
                                <div className="flex items-center gap-1.5 mb-3">
                                  <Star className="h-3.5 w-3.5 text-emerald-400" />
                                  <p className="text-xs text-emerald-400/70 uppercase tracking-widest font-bold">Strengths</p>
                                </div>
                                <ul className="space-y-2">
                                  {submission.ai_review.strengths.map((s, i) => (
                                    <li key={i} className="flex gap-2 text-xs text-white/50">
                                      <span className="text-emerald-400/50 shrink-0 mt-0.5">▸</span>
                                      <span>{s}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
                                <div className="flex items-center gap-1.5 mb-3">
                                  <Wrench className="h-3.5 w-3.5 text-amber-400" />
                                  <p className="text-xs text-amber-400/70 uppercase tracking-widest font-bold">Improvements</p>
                                </div>
                                <ul className="space-y-2">
                                  {submission.ai_review.improvements.map((s, i) => (
                                    <li key={i} className="flex gap-2 text-xs text-white/50">
                                      <span className="text-amber-400/50 shrink-0 mt-0.5">▸</span>
                                      <span>{s}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              {submission.ai_review.tech_stack_assessment && (
                                <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Cpu className="h-3.5 w-3.5 text-sky-400" />
                                    <p className="text-xs text-white/30 uppercase tracking-widest font-bold">Tech Stack</p>
                                  </div>
                                  <p className="text-xs text-white/50 leading-relaxed">{submission.ai_review.tech_stack_assessment}</p>
                                </div>
                              )}

                              {submission.ai_review.hackathon_readiness && (
                                <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Rocket className="h-3.5 w-3.5 text-orange-400" />
                                    <p className="text-xs text-white/30 uppercase tracking-widest font-bold">Hackathon Readiness</p>
                                  </div>
                                  <p className="text-xs text-white/50 leading-relaxed">{submission.ai_review.hackathon_readiness}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {submission.analysis && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-white/30">Repository Analysis</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {[
                                { label: 'Type', value: submission.analysis.project_type },
                                { label: 'Language', value: submission.analysis.primary_language || '—' },
                                { label: 'Files', value: String(submission.analysis.total_files) },
                                { label: 'Stars', value: String(submission.analysis.stars) },
                              ].map((stat, i) => (
                                <div key={i} className="rounded-lg border border-white/8 bg-white/3 p-3">
                                  <p className="text-[10px] text-white/25 uppercase tracking-wider">{stat.label}</p>
                                  <p className="text-sm font-bold text-white/70 mt-0.5">{stat.value}</p>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {submission.analysis.has_tests && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">✓ Tests</span>}
                              {submission.analysis.has_ci && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">✓ CI/CD</span>}
                              {submission.analysis.has_dockerfile && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">✓ Docker</span>}
                              {submission.analysis.has_readme && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">✓ README</span>}
                              {submission.analysis.detected_frameworks?.map(f => (
                                <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 font-semibold">{f}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {!submission.ai_review && !submission.analysis && (
                          <div className="text-center py-6">
                            <Sparkles className="h-8 w-8 text-white/10 mx-auto mb-2" />
                            <p className="text-sm text-white/30">No AI analysis data for this submission</p>
                            <p className="text-xs text-white/15 mt-1">The team did not run the DevSage Bot before submitting</p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
