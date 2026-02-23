import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Building2, Users, Trophy, ArrowLeft, Crown, Mail, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string;
  created_at: string;
  members: Array<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
    created_at: string;
  }>;
  hackathons: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    created_at: string;
  }>;
  invites: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
    expires_at: string;
  }>;
}

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'manager' });
  const [inviting, setInviting] = useState(false);

  const fetchData = async () => {
    try {
      const res = await apiRequest<{ data: WorkspaceDetail }>(`/api/v1/admin/workspaces/${id}`);
      setWorkspace(res.data);
    } catch {
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const handleInvite = async () => {
    if (!inviteForm.email) { toast.error('Email required'); return; }
    setInviting(true);
    try {
      await apiRequest(`/api/v1/workspaces/${id}/invites`, {
        method: 'POST',
        body: JSON.stringify(inviteForm),
      });
      toast.success(`Invite sent to ${inviteForm.email}`);
      setShowInvite(false);
      setInviteForm({ email: '', role: 'manager' });
      setLoading(true);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

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
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-[#CCFF00]" />
            <h1 className="text-2xl font-bold text-white">{workspace.name}</h1>
            <Badge variant="outline" className="border-white/10 text-xs text-white/50">{workspace.type}</Badge>
          </div>
          <p className="mt-1 text-sm text-white/40">
            /{workspace.slug} · Created {new Date(workspace.created_at).toLocaleDateString()}
          </p>
          {workspace.description && (
            <p className="mt-1 text-sm text-white/50">{workspace.description}</p>
          )}
        </div>
      </div>

      {/* Members */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5 text-[#CCFF00]" />
              Members ({workspace.members.length})
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowInvite(!showInvite)} className="border-white/10 text-white/60 hover:bg-white/10">
              <Plus className="h-3 w-3 mr-1" /> Invite
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showInvite && (
            <div className="rounded-lg border border-[#CCFF00]/20 bg-[#CCFF00]/[0.03] p-3 space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="Email address"
                  className="h-8 flex-1 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:border-[#CCFF00]/40 focus:outline-none"
                />
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
                  className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-sm text-white focus:border-[#CCFF00]/40 focus:outline-none"
                >
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                </select>
                <Button size="sm" onClick={handleInvite} disabled={inviting} className="bg-[#CCFF00] text-black hover:bg-[#b8e600] font-bold h-8">
                  {inviting ? '…' : 'Send'}
                </Button>
              </div>
            </div>
          )}

          {workspace.members.length === 0 ? (
            <p className="text-sm text-white/40">No members yet</p>
          ) : (
            <div className="space-y-2">
              {workspace.members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-3">
                  {member.image ? (
                    <img src={member.image} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#CCFF00] text-xs font-bold text-black">
                      {(member.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{member.name}</p>
                    <p className="text-xs text-white/40">{member.email}</p>
                  </div>
                  {member.role === 'owner' && <Crown className="h-4 w-4 text-[#CCFF00]" />}
                  <Badge variant="outline" className="border-white/10 text-xs text-white/50 capitalize">
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {workspace.invites.filter(i => i.status === 'pending').length > 0 && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Mail className="h-5 w-5 text-[#CCFF00]" />
              Pending Invites ({workspace.invites.filter(i => i.status === 'pending').length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {workspace.invites.filter(i => i.status === 'pending').map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-3">
                  <Mail className="h-4 w-4 text-white/30" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{inv.email}</p>
                    <p className="text-xs text-white/40">Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-xs text-white/50 capitalize">{inv.role}</Badge>
                  <Badge className="bg-amber-500/20 text-amber-400 text-xs">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hackathons */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Trophy className="h-5 w-5 text-[#CCFF00]" />
            Hackathons ({workspace.hackathons.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workspace.hackathons.length === 0 ? (
            <p className="text-sm text-white/40">No hackathons in this workspace</p>
          ) : (
            <div className="space-y-2">
              {workspace.hackathons.map((h) => (
                <Link key={h.id} to={`/hackathons/${h.id}`}>
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3 transition hover:border-[#CCFF00]/20">
                    <div>
                      <p className="text-sm font-medium text-white">{h.title}</p>
                      <p className="text-xs text-white/40">/{h.slug}</p>
                    </div>
                    <Badge className={statusColors[h.status] ?? 'bg-white/10 text-white/60'}>
                      {h.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
