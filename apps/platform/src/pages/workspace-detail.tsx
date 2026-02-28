import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Building, Users, Trophy, Shield, Calendar, Trash2, ArrowRightLeft, AlertTriangle } from 'lucide-react';

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferring, setTransferring] = useState(false);

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

  const currentUserRole = workspace?.members.find((m) => m.user_id === user?.id)?.role;
  const isOwner = currentUserRole === 'owner';
  const adminMembers = workspace?.members.filter((m) => m.user_id !== user?.id && (m.role === 'admin' || m.role === 'owner')) ?? [];

  async function handleDelete() {
    if (!workspace) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/v1/workspaces/${workspace.id}`, { method: 'DELETE' });
      toast.success('Workspace deleted');
      navigate('/workspaces');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete workspace';
      toast.error(message);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function handleTransfer() {
    if (!workspace || !transferTargetId) return;
    setTransferring(true);
    try {
      await apiRequest(`/api/v1/workspaces/${workspace.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ new_owner_id: transferTargetId }),
      });
      toast.success('Ownership transferred');
      // Reload workspace to reflect new roles
      const res = await apiRequest<{ data: WorkspaceDetail }>(`/api/v1/workspaces/${slug}`);
      setWorkspace(res.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to transfer ownership';
      toast.error(message);
    } finally {
      setTransferring(false);
      setTransferOpen(false);
      setTransferTargetId('');
    }
  }

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
      {/* Owner Actions */}
      {isOwner && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" /> Danger Zone
          </h2>
          <div className="border border-red-900/50 rounded-xl divide-y divide-red-900/30">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-white">Transfer Ownership</p>
                <p className="text-xs text-zinc-500 mt-0.5">Transfer this workspace to another admin member. You will be demoted to admin.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500"
                onClick={() => setTransferOpen(true)}
                disabled={adminMembers.length === 0}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                Transfer
              </Button>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-white">Delete Workspace</p>
                <p className="text-xs text-zinc-500 mt-0.5">Permanently delete this workspace. All hackathons must be draft or archived first.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-800 text-red-400 hover:bg-red-950 hover:text-red-300 hover:border-red-700"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Workspace</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete <strong className="text-white">{workspace?.name}</strong>? This action cannot be undone. All hackathons must be in draft or archived status.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="border-zinc-700 text-zinc-300">
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? 'Deleting…' : 'Delete Workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferOpen} onOpenChange={(open) => { setTransferOpen(open); if (!open) setTransferTargetId(''); }}>
        <DialogContent className="bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Transfer Ownership</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Select a member to become the new owner. You will be demoted to admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {adminMembers.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => setTransferTargetId(m.user_id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                  transferTargetId === m.user_id
                    ? 'border-[#CCFF00] bg-[#CCFF00]/5'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                    {(m.name || m.email)?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-sm font-medium text-white">{m.name || m.email}</p>
                  <p className="text-xs text-zinc-500">{m.email}</p>
                </div>
              </button>
            ))}
            {adminMembers.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">No eligible members. Add an admin member first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransferOpen(false); setTransferTargetId(''); }} className="border-zinc-700 text-zinc-300">
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferring || !transferTargetId}
              className="bg-[#CCFF00] text-black hover:bg-[#b8e600]"
            >
              {transferring ? 'Transferring…' : 'Transfer Ownership'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
