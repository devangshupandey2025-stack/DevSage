import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Building, Users, Trophy, Mail, Shield, Calendar } from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  role: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

interface WorkspaceHackathon {
  id: string;
  slug: string;
  title: string;
  status: string;
  created_at: string;
}

interface WorkspaceDetail {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  created_at: string;
  members: Member[];
  hackathons: WorkspaceHackathon[];
}

export function WorkspaceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest<{ data: WorkspaceDetail }>(`/api/v1/workspaces/${slug}`);
        setWorkspace(res.data);
      } catch {
        toast.error('Failed to load workspace');
      } finally {
        setLoading(false);
      }
    }
    if (slug) load();
  }, [slug]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="p-6 text-center text-zinc-500">
        <p>Workspace not found.</p>
      </div>
    );
  }

  const roleColor: Record<string, string> = {
    owner: 'text-[#CCFF00]',
    admin: 'text-blue-400',
    member: 'text-zinc-400',
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center">
          <Building className="w-7 h-7 text-[#CCFF00]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{workspace.name}</h1>
          <p className="text-zinc-400 capitalize">{workspace.type}</p>
        </div>
      </div>

      {workspace.description && (
        <p className="text-zinc-400">{workspace.description}</p>
      )}

      {/* Members */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" /> Members ({workspace.members.length})
        </h2>
        <div className="border border-zinc-800 rounded-xl divide-y divide-zinc-800">
          {workspace.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                    {(member.name || member.email)?.[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-white">{member.name || member.email}</p>
                  <p className="text-xs text-zinc-500">{member.email}</p>
                </div>
              </div>
              <span className={`text-xs font-medium capitalize ${roleColor[member.role] || 'text-zinc-400'}`}>
                <Shield className="w-3 h-3 inline mr-1" />
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Hackathons */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5" /> Hackathons ({workspace.hackathons.length})
        </h2>
        {workspace.hackathons.length === 0 ? (
          <p className="text-zinc-500 text-sm">No hackathons yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {workspace.hackathons.map((h) => (
              <Link
                key={h.id}
                to={`/hackathons/${h.slug}`}
                className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 transition-all"
              >
                <h3 className="font-medium text-white">{h.title}</h3>
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                  <span className="capitalize px-2 py-0.5 rounded bg-zinc-800">{h.status}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(h.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
