import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Users, GitBranch, Crown, ArrowLeft, Code2, Tag, Clock, ExternalLink } from 'lucide-react';

interface TeamMember {
  user_id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  joined_at: string;
}

interface TeamData {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface RepoData {
  id: string;
  github_repo_url: string;
  github_owner: string;
  github_repo: string;
}

interface Submission {
  id: string;
  tag_name: string;
  commit_sha: string;
  is_final: boolean;
  is_late: boolean;
  created_at: string;
}

export function TeamPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [repo, setRepo] = useState<RepoData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeam() {
      try {
        const teamRes = await apiRequest<{ ok: boolean; data: TeamData }>(`/api/v1/hackathons/${slug}/teams/me`);
        setTeam(teamRes.data);
        const teamId = teamRes.data.id;

        const [membersRes, repoRes] = await Promise.all([
          apiRequest<{ ok: boolean; data: TeamMember[] }>(`/api/v1/hackathons/${slug}/teams/${teamId}/members`),
          apiRequest<{ ok: boolean; data: RepoData }>(`/api/v1/hackathons/${slug}/teams/${teamId}/repo`).catch(() => ({ data: null })),
        ]);

        setMembers(membersRes.data || []);
        if (repoRes.data) setRepo(repoRes.data);

        // Fetch submissions for this team
        const subRes = await apiRequest<{ ok: boolean; data: Submission[] }>(`/api/v1/hackathons/${slug}/submissions/team/${teamId}/current`).catch(() => ({ data: [] as Submission[] }));
        if (Array.isArray(subRes.data)) {
          setSubmissions(subRes.data);
        } else if (subRes.data) {
          setSubmissions([subRes.data as Submission]);
        }
      } catch {
        setTeam(null);
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchTeam();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="h-10 w-10 border-2 border-white/20 border-t-[#CCFF00] rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center">
        <Users className="w-16 h-16 text-white/20 mb-4" />
        <h1 className="text-2xl font-bold mb-2">No Team Found</h1>
        <p className="text-white/40 mb-6">You haven&apos;t joined a team for this hackathon yet.</p>
        <Link to={`/hackathons/${slug}`} className="px-6 py-3 bg-[#CCFF00] text-black rounded-full font-bold hover:bg-[#bbf000] transition-colors">
          Go to Hackathon
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={`/hackathons/${slug}`} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Hackathon</span>
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <Code2 className="w-6 h-6 text-[#CCFF00]" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">{team.name}</h1>
          <p className="text-white/40 mb-8">Team for this hackathon</p>

          {/* Members */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#CCFF00]" /> Members
            </h2>
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  {m.image ? (
                    <img src={m.image} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                      <Users className="w-5 h-5 text-white/30" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-white/40">{m.email}</p>
                  </div>
                  {m.role === 'leader' && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-xs font-medium">
                      <Crown className="w-3 h-3" /> Leader
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Repository */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-emerald-400" /> Repository
            </h2>
            {repo ? (
              <a
                href={repo.github_repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-emerald-400/20 transition-colors"
              >
                <GitBranch className="w-5 h-5 text-emerald-400" />
                <span className="flex-1 font-mono text-sm">{repo.github_owner}/{repo.github_repo}</span>
                <ExternalLink className="w-4 h-4 text-white/30" />
              </a>
            ) : (
              <p className="text-white/40 text-sm p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                No repository linked yet. The team leader can link a GitHub repo.
              </p>
            )}
          </div>

          {/* Submissions */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-violet-400" /> Submissions
            </h2>
            {submissions.length > 0 ? (
              <div className="space-y-3">
                {submissions.map((s) => (
                  <div key={s.id} className={`p-4 rounded-xl border ${s.is_final ? 'border-[#CCFF00]/20 bg-[#CCFF00]/[0.02]' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-3">
                      <Tag className={`w-4 h-4 ${s.is_final ? 'text-[#CCFF00]' : 'text-white/30'}`} />
                      <span className="font-mono text-sm">{s.tag_name}</span>
                      {s.is_final && (
                        <span className="px-2 py-0.5 bg-[#CCFF00]/10 text-[#CCFF00] rounded-full text-xs font-medium">Final</span>
                      )}
                      {s.is_late && (
                        <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full text-xs font-medium">Late</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-white/30">
                      <span className="font-mono">{s.commit_sha?.substring(0, 7)}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(s.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-sm p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                No submissions yet. Push a git tag matching the submission pattern to submit.
              </p>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
