import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface Invite {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired';
  hackathon_id: string;
  hackathon_name: string;
  inviter_name: string;
  created_at: string;
  expires_at: string;
}

interface InviteResponse {
  ok: boolean;
  data: Invite;
}

export function InviteAcceptPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    const fetchInvite = async () => {
      try {
        const response = await apiRequest<InviteResponse>(`/api/v1/invites/${code}`);
        setInvite(response.data);
      } catch (err) {
        console.error(err);
        setError('Invalid or expired invite code.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [code]);

  const handleAccept = async () => {
    if (!code) return;
    setAccepting(true);
    try {
      await apiRequest(`/api/v1/invites/${code}/accept`, { method: 'POST' });
      toast.success('Invite accepted successfully!');
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      toast.error('Failed to accept invite.');
    } finally {
      setAccepting(false);
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
            <Skeleton className="h-20 w-full bg-white/10" />
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
              <CardTitle>Error</CardTitle>
            </div>
            <CardDescription className="text-white/60">{error || 'Invite not found'}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => navigate('/')} className="w-full border-white/10 text-white hover:bg-white/10">
              Go Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(invite.expires_at) < new Date();
  const isPending = invite.status === 'pending' && !isExpired;

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[80px_80px] pointer-events-none" />
      
      <Card className="relative z-10 w-full max-w-md border-white/10 bg-black/60 text-white backdrop-blur-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#CCFF00]/10">
            {invite.status === 'accepted' ? (
              <CheckCircle2 className="h-6 w-6 text-[#CCFF00]" />
            ) : isExpired ? (
              <Clock className="h-6 w-6 text-orange-400" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-[#CCFF00]" />
            )}
          </div>
          <CardTitle className="text-2xl">Hackathon Invitation</CardTitle>
          <CardDescription className="text-white/60">
            You've been invited to join the team.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="mb-1 text-xs uppercase tracking-wider text-white/40">Hackathon</div>
            <div className="font-semibold text-[#CCFF00]">{invite.hackathon_name}</div>
            
            <div className="mt-4 mb-1 text-xs uppercase tracking-wider text-white/40">Role</div>
            <div className="font-medium capitalize">{invite.role.replace('_', ' ')}</div>
            
            <div className="mt-4 mb-1 text-xs uppercase tracking-wider text-white/40">Invited By</div>
            <div className="font-medium">{invite.inviter_name}</div>
          </div>

          <div className="flex justify-center">
            {invite.status === 'accepted' ? (
              <Badge variant="outline" className="border-[#CCFF00] text-[#CCFF00]">Already Accepted</Badge>
            ) : isExpired ? (
              <Badge variant="destructive">Expired</Badge>
            ) : (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">Pending Acceptance</Badge>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {isPending && (
            isAuthenticated ? (
              <Button 
                className="w-full bg-[#CCFF00] text-black hover:bg-[#b3e600]" 
                onClick={handleAccept}
                disabled={accepting}
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </Button>
            ) : (
              <Button 
                className="w-full bg-white text-black hover:bg-white/90" 
                onClick={() => navigate(`/login?next=/invite/${code}`)}
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
