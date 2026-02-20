import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Building2, Users, Trophy, ArrowLeft, Crown } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  type: string;
  created_at: string;
}

interface WorkspaceMember {
  id: string;
  user_id: string;
  display_name: string;
  email: string | null;
  image: string | null;
  role: string;
  joined_at: string;
}

interface WorkspaceHackathon {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [hackathons, setHackathons] = useState<WorkspaceHackathon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [wsRes, membersRes, hackRes] = await Promise.all([
          apiRequest<{ data: Workspace }>(`/api/v1/admin/workspaces/${id}`),
          apiRequest<{ data: WorkspaceMember[] }>(`/api/v1/admin/workspaces/${id}/members`),
          apiRequest<{ data: WorkspaceHackathon[] }>(`/api/v1/admin/workspaces/${id}/hackathons`),
        ]);
        setWorkspace(wsRes.data);
        setMembers(membersRes.data);
        setHackathons(hackRes.data);
      } catch {
        setWorkspace(null);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="py-20 text-center">
        <p className="text-white/60">Workspace not found</p>
        <Link to="/workspaces" className="mt-4 inline-block text-[#CCFF00] hover:underline">
          Back to workspaces
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-white/10 text-white/60',
    active: 'bg-emerald-500/20 text-emerald-400',
    judging: 'bg-purple-500/20 text-purple-400',
    completed: 'bg-sky-500/20 text-sky-400',
    archived: 'bg-white/5 text-white/30',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/workspaces">
          <Button variant="ghost" size="icon" className="text-white/60 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-[#CCFF00]" />
            <h1 className="text-2xl font-bold text-white">{workspace.name}</h1>
          </div>
          <p className="mt-1 text-sm text-white/40">
            /{workspace.slug} · Created {new Date(workspace.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Members */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Users className="h-5 w-5 text-[#CCFF00]" />
            Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-white/40">No members</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-3">
                  {member.image ? (
                    <img src={member.image} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#CCFF00] text-xs font-bold text-black">
                      {member.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{member.display_name}</p>
                    <p className="text-xs text-white/40">{member.email}</p>
                  </div>
                  {member.role === 'owner' && <Crown className="h-4 w-4 text-[#CCFF00]" />}
                  <Badge variant="outline" className="border-white/10 text-xs text-white/50">
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hackathons */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Trophy className="h-5 w-5 text-[#CCFF00]" />
            Hackathons ({hackathons.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hackathons.length === 0 ? (
            <p className="text-sm text-white/40">No hackathons in this workspace</p>
          ) : (
            <div className="space-y-2">
              {hackathons.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                  <div>
                    <p className="text-sm font-medium text-white">{h.name}</p>
                    <p className="text-xs text-white/40">/{h.slug}</p>
                  </div>
                  <Badge className={statusColors[h.status] ?? 'bg-white/10 text-white/60'}>
                    {h.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
