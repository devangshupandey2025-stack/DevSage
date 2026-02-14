import { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface Invite {
  id: string;
  email: string;
  invite_code: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
}

interface InvitesResponse {
  ok: boolean;
  data: Invite[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const limit = 10;

  async function fetchInvites() {
    setIsLoading(true);
    try {
      const response = await apiRequest<InvitesResponse>(
        `/api/v1/admin/invites?limit=${limit}&offset=${page * limit}`
      );
      setInvites(response.data);
    } catch (error) {
      toast.error('Failed to fetch invites');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchInvites();
  }, [page]);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!newInviteEmail) return;

    setIsSubmitting(true);
    try {
      await apiRequest('/api/v1/admin/invites', {
        method: 'POST',
        body: JSON.stringify({ email: newInviteEmail }),
      });
      toast.success('Invite created');
      setNewInviteEmail('');
      setIsDialogOpen(false);
      fetchInvites();
    } catch (error) {
      toast.error('Failed to create invite');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function revokeInvite(id: string) {
    if (!confirm('Are you sure you want to revoke this invite?')) return;

    try {
      await apiRequest(`/api/v1/admin/invites/${id}`, {
        method: 'DELETE',
      });
      toast.success('Invite revoked');
      fetchInvites();
    } catch (error) {
      toast.error('Failed to revoke invite');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20';
      case 'accepted':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20';
      case 'expired':
        return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20 border-gray-500/20';
      case 'revoked':
        return 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Organizer Invites</h1>
          <p className="text-white/60">Manage invitations for new hackathon organizers.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#CCFF00] text-black hover:bg-[#b3e600]">
              <Plus className="mr-2 h-4 w-4" />
              New Invite
            </Button>
          </DialogTrigger>
          <DialogContent className="border-white/10 bg-black text-white sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Invite</DialogTitle>
              <DialogDescription className="text-white/60">
                Send an invitation to a new organizer. They will receive an email with a unique code.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createInvite} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-white">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="organizer@example.com"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                  className="border-white/10 bg-white/5 text-white focus:border-[#CCFF00]"
                  required
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#CCFF00] text-black hover:bg-[#b3e600]"
                >
                  {isSubmitting ? 'Creating...' : 'Create Invite'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">Invites List</CardTitle>
          <CardDescription className="text-white/60">
            View and manage all issued invites.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-white/10">
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm text-left">
                <thead className="[&_tr]:border-b [&_tr]:border-white/10">
                  <tr className="border-b border-white/10 transition-colors hover:bg-white/5 data-[state=selected]:bg-white/10">
                    <th className="h-12 px-4 align-middle font-medium text-white/60">Email</th>
                    <th className="h-12 px-4 align-middle font-medium text-white/60">Code</th>
                    <th className="h-12 px-4 align-middle font-medium text-white/60">Status</th>
                    <th className="h-12 px-4 align-middle font-medium text-white/60">Created</th>
                    <th className="h-12 px-4 align-middle font-medium text-white/60 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="h-24 text-center text-white/60">
                        Loading...
                      </td>
                    </tr>
                  ) : invites.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="h-24 text-center text-white/60">
                        No invites found.
                      </td>
                    </tr>
                  ) : (
                    invites.map((invite) => (
                      <tr
                        key={invite.id}
                        className="border-b border-white/10 transition-colors hover:bg-white/5 data-[state=selected]:bg-white/10"
                      >
                        <td className="p-4 align-middle text-white">{invite.email}</td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-white/10 px-2 py-1 font-mono text-xs text-[#CCFF00]">
                              {invite.invite_code}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(invite.invite_code)}
                              className="text-white/40 hover:text-white"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <Badge variant="outline" className={getStatusColor(invite.status)}>
                            {invite.status}
                          </Badge>
                        </td>
                        <td className="p-4 align-middle text-white/60">
                          {new Date(invite.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 align-middle text-right">
                          {invite.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => revokeInvite(invite.id)}
                              className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Revoke</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="border-white/10 bg-transparent text-white hover:bg-white/10"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={invites.length < limit || isLoading}
              className="border-white/10 bg-transparent text-white hover:bg-white/10"
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
