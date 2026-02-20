import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Gavel, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface JudgeInvite {
  id: string;
  hackathon_name: string;
  hackathon_slug: string;
  inviter_name: string;
  status: string;
  expires_at: string;
}

export function JudgeInviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading: authLoading, refreshToken } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<JudgeInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await apiRequest<{ data: JudgeInvite }>(`/api/v1/invites/judge/${token}/details`);
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
      await apiRequest(`/api/v1/invites/judge/${token}`, { method: 'POST' });
      toast.success('Invite accepted! You are now a judge.');
      // Refresh auth so ProtectedRoute picks up isJudge: true
      await refreshToken();
      navigate(`/hackathons/${invite?.hackathon_slug}/judge`);
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
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#CCFF00]/20 bg-[#CCFF00]/10">
            <Gavel className="h-8 w-8 text-[#CCFF00]" />
          </div>
          <CardTitle className="text-xl text-white">Judge Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!invite ? (
            <div className="text-center">
              <XCircle className="mx-auto h-10 w-10 text-red-400" />
              <p className="mt-3 text-white/60">This invite link is invalid or has been revoked.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-white/40">Hackathon</span>
                  <span className="text-sm font-medium text-white">{invite.hackathon_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/40">Invited by</span>
                  <span className="text-sm text-white">{invite.inviter_name}</span>
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
                <Button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full bg-[#CCFF00] text-black hover:bg-[#CCFF00]/80"
                >
                  {accepting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Accept Invitation
                </Button>
              )}

              {isPending && !isExpired && !isAuthenticated && (
                <div className="text-center">
                  <p className="text-sm text-white/60">You need to sign in to accept this invitation.</p>
                  <a
                    href={`/login?redirect=/invite/judge/${token}`}
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
