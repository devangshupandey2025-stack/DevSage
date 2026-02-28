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
  Upload,
  X,
  Shield,
  Ban,
  Trophy,
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
  status: string;
  repo_url: string | null;
  members: TeamMember[];
  created_at: string;
}

type StatusFilter = 'all' | 'forming' | 'advanced' | 'eliminated';

const statusFilters: { key: StatusFilter; label: string; icon: typeof Users }[] = [
  { key: 'all', label: 'All', icon: Users },
  { key: 'forming', label: 'Active', icon: Shield },
  { key: 'advanced', label: 'Advanced', icon: Trophy },
  { key: 'eliminated', label: 'Eliminated', icon: Ban },
];

const statusBadgeConfig: Record<string, { label: string; color: string; bg: string }> = {
  forming: { label: 'Active', color: '#CCFF00', bg: 'rgba(204,255,0,0.1)' },
  advanced: { label: 'Advanced', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
  eliminated: { label: 'Eliminated', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [seedMode, setSeedMode] = useState<'full_structure' | 'leaders_only' | 'participants_only'>('leaders_only');
  const [seedInput, setSeedInput] = useState('');
  const [seeding, setSeeding] = useState(false);

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

  const handleSeed = async () => {
    if (!slug || !seedInput.trim()) return;
    setSeeding(true);
    try {
      let payload: Record<string, unknown>;
      if (seedMode === 'participants_only') {
        const emails = seedInput.split('\n').map(e => e.trim()).filter(Boolean);
        payload = { mode: seedMode, emails };
      } else {
        // Parse as JSON array: [{ team_name, leader_email, member_emails? }]
        try {
          const parsed = JSON.parse(seedInput);
          payload = { mode: seedMode, teams: parsed };
        } catch {
          // Fallback: parse as CSV lines — "Team Name, leader@email.com"
          const lines = seedInput.split('\n').filter(l => l.trim());
          const teams = lines.map(line => {
            const parts = line.split(',').map(p => p.trim());
            return { team_name: parts[0], leader_email: parts[1], member_emails: parts.slice(2) };
          });
          payload = { mode: seedMode, teams };
        }
      }
      const res = await apiRequest<{ data: { total_invites_sent: number; teams: unknown[] } }>(
        `/api/v1/hackathons/${slug}/teams/seed`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      toast.success(`Seeded ${res.data.teams?.length ?? 0} teams, ${res.data.total_invites_sent} invites sent`);
      setShowSeedDialog(false);
      setSeedInput('');
      fetchTeams();
    } catch {
      toast.error('Failed to seed participants');
    } finally {
      setSeeding(false);
    }
  };

  const filtered = teams.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const statusCounts = {
    all: teams.length,
    forming: teams.filter((t) => t.status === 'forming' || !t.status).length,
    advanced: teams.filter((t) => t.status === 'advanced').length,
    eliminated: teams.filter((t) => t.status === 'eliminated').length,
  };

  return (
    <div>
      <PageHeader
        title="Teams"
        description={`${teams.length} team${teams.length !== 1 ? 's' : ''} registered${statusFilter !== 'all' ? ` · ${filtered.length} ${statusFilter}` : ''}`}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSeedDialog(true)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold border border-[#CCFF00]/20 bg-[#CCFF00]/8 text-[#CCFF00] hover:bg-[#CCFF00]/15 transition-all"
            >
              <Upload className="h-3 w-3" /> Seed Participants
            </button>
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

      {/* Status filter tabs */}
      {!loading && teams.length > 0 && (
        <div className="flex items-center gap-1 rounded-xl border border-white/6 bg-white/2 p-1 mb-6 w-fit">
          {statusFilters.map((f) => {
            const Icon = f.icon;
            const count = statusCounts[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  statusFilter === f.key
                    ? 'bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/4'
                }`}
              >
                <Icon className="h-4 w-4" />
                {f.label}
                {count > 0 && (
                  <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    statusFilter === f.key ? 'bg-[#CCFF00]/20 text-[#CCFF00]' : 'bg-white/8 text-white/30'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

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
              className={`group rounded-2xl border p-5 transition-all duration-300 ${
                team.status === 'eliminated'
                  ? 'border-red-500/10 bg-red-500/3 opacity-60 hover:opacity-80'
                  : team.status === 'advanced'
                    ? 'border-emerald-500/10 bg-emerald-500/3 hover:border-emerald-500/20 hover:bg-emerald-500/5'
                    : 'border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className={`text-base font-bold transition-colors ${
                    team.status === 'eliminated' ? 'text-white/50 line-through' : 'text-white group-hover:text-[#CCFF00]'
                  }`}>
                    {team.name}
                  </h3>
                  <p className="text-xs text-white/30 mt-0.5">
                    {team.members?.length ?? 0} member{(team.members?.length ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const badge = statusBadgeConfig[team.status] ?? statusBadgeConfig.forming;
                    return (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
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

      {/* Seed Participants Dialog */}
      {showSeedDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Seed Participants</h3>
              <button onClick={() => setShowSeedDialog(false)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Mode</label>
              <select
                value={seedMode}
                onChange={(e) => setSeedMode(e.target.value as typeof seedMode)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
              >
                <option value="full_structure">Full Structure (team + leader + members)</option>
                <option value="leaders_only">Leaders Only (team + leader)</option>
                <option value="participants_only">Participants Only (emails)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                {seedMode === 'participants_only'
                  ? 'Enter one email per line'
                  : 'Enter CSV (Team Name, leader@email.com, member1@email.com, ...)'}
              </label>
              <textarea
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                rows={8}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm font-mono resize-none"
                placeholder={
                  seedMode === 'participants_only'
                    ? 'alice@example.com\nbob@example.com\n...'
                    : 'Team Alpha, leader@example.com, member1@example.com\nTeam Beta, leader2@example.com'
                }
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSeedDialog(false)}
                className="px-4 py-2 border border-zinc-700 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSeed}
                disabled={seeding || !seedInput.trim()}
                className="px-4 py-2 bg-[#CCFF00] text-black rounded-lg text-sm font-bold hover:bg-[#CCFF00]/80 disabled:opacity-40 transition-all"
              >
                {seeding ? 'Seeding...' : 'Seed Participants'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
