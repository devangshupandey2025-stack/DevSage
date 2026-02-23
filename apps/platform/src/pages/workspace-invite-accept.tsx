import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Building2 } from 'lucide-react';

interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  inviter_name: string | null;
}

export function WorkspaceInviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [invite, setInvite] = useState<WorkspaceInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchInvite = async () => {
      try {
        const res = await apiRequest<{ data: WorkspaceInvite }>(`/api/v1/workspaces/invites/token/${token}`);
        setInvite(res.data);
      } catch {
        setError('Invalid or expired invite link.');
      } finally {
        setLoading(false);
      }
    };
    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      await apiRequest(`/api/v1/workspaces/invites/token/${token}/accept`, { method: 'POST' });
      toast.success('Workspace invite accepted!');
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invite';
      toast.error(message);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    try {
      await apiRequest(`/api/v1/workspaces/invites/token/${token}/decline`, { method: 'POST' });
      toast.success('Invite declined');
      navigate('/login');
    } catch {
      toast.error('Failed to decline invite');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4">
        <Card className="w-full max-w-md border-white/10 bg-white/5 text-white">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 bg-white/10" />
            <Skeleton className="h-4 w-1/2 bg-white/10" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full bg-white/10" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4">
        <Card className="w-full max-w-md border-red-500/20 bg-red-500/5 text-white">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="h-6 w-6" />
              <CardTitle>Invalid Invite</CardTitle>
            </div>
            <CardDescription className="text-white/60">{error || 'Invite not found'}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => navigate('/login')} className="w-full border-white/10 text-white hover:bg-white/10">
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(invite.expires_at) < new Date();

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:80px_80px] pointer-events-none" />

      <Card className="relative z-10 w-full max-w-md border-white/10 bg-black/60 text-white backdrop-blur-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#CCFF00]/10">
            {isExpired ? (
              <Clock className="h-7 w-7 text-orange-400" />
            ) : (
              <Building2 className="h-7 w-7 text-[#CCFF00]" />
            )}
          </div>
          <CardTitle className="text-2xl">Workspace Invitation</CardTitle>
          <CardDescription className="text-white/60">
            {invite.inviter_name
              ? `${invite.inviter_name} has invited you to join a workspace`
              : "You've been invited to join a workspace"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-white/40">Workspace</div>
              <div className="font-semibold text-white text-lg">{invite.workspace_name}</div>
              <div className="text-xs text-white/40">/{invite.workspace_slug}</div>
            </div>

            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-white/40">Your Role</div>
              <div className="font-semibold text-[#CCFF00] capitalize">{invite.role}</div>
            </div>

            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-white/40">Invited Email</div>
              <div className="font-medium">{invite.email}</div>
            </div>

            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-white/40">Expires</div>
              <div className="font-medium">{new Date(invite.expires_at).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="flex justify-center">
            {isExpired ? (
              <Badge variant="destructive">Expired</Badge>
            ) : (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-400">Pending Acceptance</Badge>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {!isExpired && (
            isAuthenticated ? (
              <>
                <Button
                  className="w-full bg-[#CCFF00] text-black hover:bg-[#b3e600] font-bold"
                  onClick={handleAccept}
                  disabled={accepting}
                >
                  {accepting ? 'Accepting...' : 'Accept Invitation'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-white/10 text-white/60 hover:bg-white/10"
                  onClick={handleDecline}
                >
                  Decline
                </Button>
              </>
            ) : (
              <Button
                className="w-full bg-white text-black hover:bg-white/90"
                onClick={() => navigate(`/login?next=/invite/workspace/${token}`)}
              >
                Log in to Accept
              </Button>
            )
          )}

          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="w-full text-white/60 hover:text-white">
            {isAuthenticated ? 'Go to Dashboard' : 'Go Home'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
