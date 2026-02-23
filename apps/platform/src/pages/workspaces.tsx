import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Building, Users, Trophy, ArrowRight } from 'lucide-react';

interface Workspace {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  created_at: string;
}

interface WorkspaceMembership {
  workspace: Workspace;
  role: string;
}

export function WorkspacesPage() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest<{ data: Array<{ id: string; slug: string; name: string; type: string; description: string | null; created_at: string; member_role: string }> }>('/api/v1/workspaces');
        setMemberships(res.data?.map(w => ({
          workspace: { id: w.id, slug: w.slug, name: w.name, type: w.type, description: w.description, created_at: w.created_at },
          role: w.member_role,
        })) || []);
      } catch (err) {
        toast.error('Failed to load workspaces');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Workspaces</h1>
        <p className="text-zinc-400 mt-1">Organizations and clubs you belong to</p>
      </div>

      {memberships.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Building className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No workspaces yet</p>
          <p className="text-sm mt-1">You'll see workspaces here once you're invited to one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memberships.map(({ workspace, role }) => (
            <Link
              key={workspace.id}
              to={`/workspaces/${workspace.slug}`}
              className="group border border-zinc-800 rounded-xl p-5 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#CCFF00]/10 flex items-center justify-center">
                    <Building className="w-5 h-5 text-[#CCFF00]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-[#CCFF00] transition-colors">
                      {workspace.name}
                    </h3>
                    <span className="text-xs text-zinc-500 capitalize">{role}</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-[#CCFF00] transition-colors" />
              </div>
              {workspace.description && (
                <p className="text-sm text-zinc-400 mt-3 line-clamp-2">{workspace.description}</p>
              )}
              <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
                <span className="capitalize">{workspace.type}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
