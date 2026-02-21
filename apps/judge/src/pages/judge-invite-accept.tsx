import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Gavel, CheckCircle2, XCircle, Loader2, User, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface JudgeInvite {
  id: string;
  hackathon_name: string;
  hackathon_slug: string;
  inviter_name: string | null;
  email: string;
  user_exists: boolean;
  status: string;
}

export function JudgeInviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading: authLoading, refreshToken } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<JudgeInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await apiRequest<{ data: JudgeInvite }>(`/api/v1/invites/judge/token/${token}`);
        setInvite(res.data);
        if (res.data.user_exists) {
          setFormData(prev => ({ ...prev, name: 'Existing User' }));
        }
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
    
    if (!invite?.user_exists) {
      if (!formData.name.trim()) {
        toast.error('Please enter your name');
        return;
      }
      if (!formData.password) {
        toast.error('Please enter a password');
        return;
      }
      if (formData.password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    setAccepting(true);
    try {
      const res = await apiRequest<{ data: { accepted: boolean; hackathon_id: string; user_created: boolean } }>(
        `/api/v1/invites/judge/token/${token}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: formData.name,
            password: formData.password,
          }),
        }
      );
      
      toast.success(res.data?.user_created 
        ? 'Account created and invite accepted! You are now a judge.' 
        : 'Invite accepted! You are now a judge.'
      );
      
      await refreshToken();
      navigate(`/hackathons/${invite?.hackathon_slug}/score`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    if (!token) return;
    
    try {
      await apiRequest(`/api/v1/invites/judge/token/${token}/decline`, {
        method: 'POST',
      });
      toast.success('Invite declined');
      navigate('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to decline invite');
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Skeleton className="h-64 w-96" />
      </div>
    );
  }

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
              <Button 
                onClick={() => navigate('/login')} 
                className="mt-4 bg-[#CCFF00] text-black hover:bg-[#CCFF00]/80"
              >
                Go to Login
              </Button>
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
                  <span className="text-sm text-white">{invite.inviter_name ?? 'Organizer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/40">Email</span>
                  <span className="text-sm text-white">{invite.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/40">Status</span>
                  <Badge className={
                    invite.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-amber-500/20 text-amber-400'
                  }>
                    {invite.status}
                  </Badge>
                </div>
              </div>

              {isPending && (
                <div className="space-y-4">
                  {!invite.user_exists && (
                    <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
                      <p className="text-sm text-white/60">
                        Create your account to accept this invitation:
                      </p>
                      
                      <div className="space-y-2">
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                          <Input
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Your full name"
                            className="border-white/8 bg-white/3 pl-10 text-white placeholder:text-white/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Create a password (min 8 chars)"
                            className="border-white/8 bg-white/3 pl-10 pr-10 text-white placeholder:text-white/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            placeholder="Confirm your password"
                            className="border-white/8 bg-white/3 pl-10 text-white placeholder:text-white/20"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {invite.user_exists && isAuthenticated && (
                    <p className="text-center text-sm text-white/60">
                      You are signed in as <strong className="text-white">{invite.email}</strong>.
                      Click below to accept the invitation.
                    </p>
                  )}

                  {invite.user_exists && !isAuthenticated && (
                    <div className="text-center space-y-2">
                      <p className="text-sm text-white/60">
                        You already have an account. Please sign in to accept this invitation.
                      </p>
                      <a
                        href={`/login?redirect=/invite/judge/${token}`}
                        className="inline-block text-sm text-[#CCFF00] hover:underline"
                      >
                        Sign in to continue
                      </a>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleDecline}
                      className="flex-1 border-white/10 bg-transparent text-white/60 hover:bg-white/6 hover:text-white"
                    >
                      Decline
                    </Button>
                    
                    {(invite.user_exists && isAuthenticated) || !invite.user_exists ? (
                      <Button
                        onClick={handleAccept}
                        disabled={accepting}
                        className="flex-1 bg-[#CCFF00] text-black hover:bg-[#CCFF00]/80"
                      >
                        {accepting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        {invite.user_exists ? 'Accept Invitation' : 'Create Account & Accept'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}

              {invite.status === 'accepted' && (
                <div className="text-center space-y-4">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
                  <p className="text-white/60">You&apos;ve already accepted this invite.</p>
                  <Button 
                    onClick={() => navigate(`/hackathons/${invite.hackathon_slug}/score`)} 
                    className="bg-[#CCFF00] text-black hover:bg-[#CCFF00]/80"
                  >
                    Go to Judging
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
