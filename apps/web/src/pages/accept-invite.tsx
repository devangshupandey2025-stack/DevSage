import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface TeamInvite {
  id: string;
  team_name: string;
  hackathon_name: string;
  hackathon_slug: string;
  inviter_name: string;
  role: string;
  status: string;
  expires_at: string;
}

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<TeamInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await apiRequest<{ data: TeamInvite }>(`/api/v1/invites/${token}`);
        setInvite(res.data);
      } catch {
        setInvite(null);
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchInvite();
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    try {
      await apiRequest(`/api/v1/invites/${token}/accept`, { method: 'POST' });
      toast.success('Invite accepted! You have joined the team.');
      navigate(`/hackathons/${invite?.hackathon_slug}/teams`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Skeleton className="h-64 w-96" />
      </div>
    );
  }

  const isExpired = invite?.expires_at ? new Date(invite.expires_at) < new Date() : false;
  const isPending = invite?.status === 'pending';

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <Card className="w-full max-w-md border-white/10 bg-white/5">
        <CardContent className="space-y-6 pt-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#CCFF00]/20 bg-[#CCFF00]/10">
              <UserPlus className="h-8 w-8 text-[#CCFF00]" />
            </div>
            <h1 className="text-xl font-bold text-white">Team Invitation</h1>
          </div>

          {!invite ? (
            <div className="text-center">
              <XCircle className="mx-auto h-10 w-10 text-red-400" />
              <p className="mt-3 text-white/60">This invite link is invalid or has been revoked.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-white/40">Team</span>
                  <span className="text-sm font-medium text-white">{invite.team_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/40">Hackathon</span>
                  <span className="text-sm text-white">{invite.hackathon_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/40">Invited by</span>
                  <span className="text-sm text-white">{invite.inviter_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/40">Role</span>
                  <Badge variant="outline" className="border-white/10 text-xs text-white/60">
                    {invite.role.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/40">Status</span>
                  <Badge className={
                    invite.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' :
                    isExpired ? 'bg-red-500/20 text-red-400' :
                    'bg-amber-500/20 text-amber-400'
                  }>
                    {isExpired ? 'Expired' : invite.status}
                  </Badge>
                </div>
              </div>

              {isPending && !isExpired && isAuthenticated && (
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={accepting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#CCFF00] py-3 font-semibold text-black transition hover:bg-[#CCFF00]/80 disabled:opacity-50"
                >
                  {accepting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Accept & Join Team
                </button>
              )}

              {isPending && !isExpired && !isAuthenticated && (
                <div className="text-center">
                  <p className="text-sm text-white/60">Sign in to accept this invitation.</p>
                  <a
                    href={`/login?redirect=/invite/${token}`}
                    className="mt-2 inline-block text-sm text-[#CCFF00] hover:underline"
                  >
                    Sign in to continue
                  </a>
                </div>
              )}

              {invite.status === 'accepted' && (
                <div className="text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
                  <p className="mt-2 text-white/60">You&apos;ve already accepted this invite.</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
