import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, CheckCircle, XCircle, Clock } from 'lucide-react';

interface InviteStatus {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
}

export function InviteAcceptPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [invite, setInvite] = useState<InviteStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError('Invalid invite code');
      setIsLoading(false);
      return;
    }

    async function fetchInvite() {
      try {
        const response = await apiRequest<{ ok: boolean; data: InviteStatus }>(`/invites/${code}`);
        setInvite(response.data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load invite';
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInvite();
  }, [code]);

  async function handleAccept() {
    if (!code) return;
    
    setIsAccepting(true);
    try {
      await apiRequest(`/invites/${code}/accept`, { method: 'POST' });
      toast.success('Invite accepted successfully!');
      
      if (invite) {
        setInvite({ ...invite, status: 'accepted' });
      }
      
      setTimeout(() => {
        navigate('/organiser');
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to accept invite';
      toast.error(message);
      setIsAccepting(false);
    }
  }

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-white">
          <CardHeader className="space-y-2">
            <Skeleton className="h-8 w-3/4 bg-zinc-800" />
            <Skeleton className="h-4 w-1/2 bg-zinc-800" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full bg-zinc-800" />
            <Skeleton className="h-10 w-full bg-zinc-800" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle className="text-xl text-center">Authentication Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-zinc-400">
              Please log in to view and accept this invitation.
            </p>
            <Button 
              className="w-full bg-[#CCFF00] text-black hover:bg-[#b3e600]"
              onClick={() => navigate('/login', { state: { from: `/invites/${code}` } })}
            >
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-white">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <CardTitle className="text-xl text-center">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-zinc-400">{error || 'Invite not found'}</p>
            <Button 
              variant="outline" 
              className="mt-6 border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
              onClick={() => navigate('/')}
            >
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(invite.expires_at) < new Date();
  const isPending = invite.status === 'pending' && !isExpired;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-white shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            {invite.status === 'accepted' ? (
              <CheckCircle className="h-12 w-12 text-[#CCFF00]" />
            ) : isExpired || invite.status === 'expired' || invite.status === 'revoked' ? (
              <XCircle className="h-12 w-12 text-red-500" />
            ) : (
              <Mail className="h-12 w-12 text-[#CCFF00]" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">Organizer Invitation</CardTitle>
          <p className="text-zinc-400 text-sm">
            You've been invited to join the organizing team
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4 bg-zinc-950/50 p-4 rounded-lg border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-sm">Email</span>
              <span className="font-medium">{invite.email}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-sm">Status</span>
              <Badge 
                variant={
                  invite.status === 'accepted' ? 'default' : 
                  isExpired || invite.status === 'expired' || invite.status === 'revoked' ? 'destructive' : 
                  'secondary'
                }
                className={
                  invite.status === 'accepted' ? 'bg-[#CCFF00] text-black hover:bg-[#b3e600]' :
                  isExpired || invite.status === 'expired' || invite.status === 'revoked' ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' :
                  'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }
              >
                {isExpired && invite.status === 'pending' ? 'Expired' : 
                 invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-sm">Expires</span>
              <div className="flex items-center gap-1 text-sm">
                <Clock className="h-3 w-3 text-zinc-500" />
                <span>{new Date(invite.expires_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {isPending && (
            <Button 
              className="w-full bg-[#CCFF00] text-black hover:bg-[#b3e600] font-medium h-11"
              onClick={handleAccept}
              disabled={isAccepting}
            >
              {isAccepting ? 'Accepting...' : 'Accept Invitation'}
            </Button>
          )}

          {invite.status === 'accepted' && (
            <div className="text-center p-2 bg-[#CCFF00]/10 rounded-lg border border-[#CCFF00]/20">
              <p className="text-[#CCFF00] font-medium">Invitation Accepted</p>
              <p className="text-zinc-400 text-xs mt-1">Redirecting to dashboard...</p>
            </div>
          )}

          {(invite.status === 'revoked' || invite.status === 'expired' || isExpired) && (
            <div className="text-center p-2 bg-red-900/10 rounded-lg border border-red-900/20">
              <p className="text-red-400 font-medium">
                {invite.status === 'revoked' ? 'Invitation Revoked' : 'Invitation Expired'}
              </p>
              <p className="text-zinc-500 text-xs mt-1">Please contact the administrator for a new invite.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
