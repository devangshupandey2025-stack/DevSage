import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { PageHeader, EmptyState } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Users,
  Search,
  UserPlus,
  Crown,
  GitBranch,
  ExternalLink,
} from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  display_name: string;
  github_username: string;
  image: string | null;
  role: string;
}

interface Team {
  id: string;
  name: string;
  hackathon_id: string;
  repo_url: string | null;
  members: TeamMember[];
  created_at: string;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export function TeamsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!slug) return;
    fetchTeams();
  }, [slug]);

  const fetchTeams = async () => {
    try {
      const res = await apiRequest<{ data: Team[] }>(`/api/v1/hackathons/${slug}/teams`);
      setTeams(res.data ?? []);
    } catch (_err) {
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Teams"
        description={`${teams.length} teams registered`}
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teams..."
                className="pl-9 border-white/8 bg-white/3 text-white placeholder:text-white/20 w-56"
              />
            </div>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={`s-${String(i)}`} className="h-48 bg-white/6 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No teams match your search' : 'No teams yet'}
          description={search ? 'Try a different search term.' : 'Teams will appear here once participants register and form teams.'}
        />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((team) => (
            <motion.div
              key={team.id}
              variants={item}
              className="group rounded-2xl border border-white/ bg-white/2 p-5 transition-all duration-300 hover:border-white/12 hover:bg-white/4"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-[#CCFF00] transition-colors">
                    {team.name}
                  </h3>
                  <p className="text-xs text-white/30 mt-0.5">
                    {team.members?.length ?? 0} member{(team.members?.length ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                {team.repo_url && (
                  <a
                    href={team.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/4 text-white/25 transition hover:bg-white/8 hover:text-white/50"
                  >
                    <GitBranch className="h-4 w-4" />
                  </a>
                )}
              </div>

              {/* Members */}
              <div className="space-y-2">
                {(team.members ?? []).slice(0, 4).map((member) => (
                  <div key={member.id} className="flex items-center gap-2.5">
                    {member.image ? (
                      <img src={member.image} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-[9px] font-bold text-white/40">
                        {member.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <span className="text-xs text-white/50 truncate flex-1">{member.display_name}</span>
                    {member.role === 'team_leader' && (
                      <Crown className="h-3 w-3 text-[#CCFF00]/60" />
                    )}
                  </div>
                ))}
                {(team.members?.length ?? 0) > 4 && (
                  <p className="text-[10px] text-white/20 pl-8">+{(team.members?.length ?? 0) - 4} more</p>
                )}
              </div>

              {team.repo_url && (
                <div className="mt-4 pt-3 border-t border-white/4">
                  <a
                    href={team.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] text-white/25 hover:text-[#CCFF00] transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {team.repo_url.replace('https://github.com/', '')}
                  </a>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
