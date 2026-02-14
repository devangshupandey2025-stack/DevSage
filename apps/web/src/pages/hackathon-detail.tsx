import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, FileText, Calendar, Ticket } from 'lucide-react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useCustomHackathonPage } from '@/hooks/use-custom-hackathon-page';

// Local interfaces matching snake_case API response
interface Hackathon {
  id: string;
  slug: string;
  title: string;
  description: string;
  rules_md?: string | null;
  primary_color?: string | null;
  banner_r2_key?: string | null;
  logo_r2_key?: string | null;
  status: 'draft' | 'registration_open' | 'registration_closed' | 'active' | 'judging' | 'completed' | 'archived';
  registration_opens: string;
  registration_closes: string;
  submission_deadline: string;
  judging_starts?: string;
  judging_ends?: string;
  min_team_size?: number;
  max_team_size: number;
  max_teams?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TeamMember {
  user_id: string;
  role: 'leader' | 'member';
  joined_at: string;
  display_name: string;
}

interface Team {
  id: string;
  hackathon_id: string;
  name: string;
  repo_full_name?: string | null;
  repo_url?: string | null;
  invite_code: string;
  bot_active?: boolean;
  github_installation_id?: number | null;
  created_at: string;
  members?: TeamMember[];
}

interface Submission {
  id: string;
  hackathon_id: string;
  team_id: string;
  tag_name: string;
  commit_sha: string;
  submitted_at: string;
  is_late: boolean;
  is_final: boolean;
  version: number;
  status: string;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  meta?: { total?: number; limit?: number; offset?: number };
}

export function HackathonDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const id = slug; // route uses :slug
  const { user } = useAuth();

  const { CustomPage } = useCustomHackathonPage(slug);

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  // Local UI state for hero modals
  const [openRegister, setOpenRegister] = useState(false);
  const [openRules, setOpenRules] = useState(false);
  const [openSchedule, setOpenSchedule] = useState(false);

  
  // Participant actions
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, user]);



  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [hackathonRes, teamsRes] = await Promise.all([
        apiRequest<ApiEnvelope<Hackathon>>(`/api/v1/hackathons/${id}`),
        apiRequest<ApiEnvelope<Team[]>>(`/api/v1/hackathons/${id}/teams`),
      ]);

       setHackathon(hackathonRes.data);
       setTeams(teamsRes.data);

       // Submissions require participant role — fetch separately so a 403
       // doesn't break the entire page for users who haven't joined yet.
       try {
         const submissionsRes = await apiRequest<ApiEnvelope<Submission[]>>(
           `/api/v1/hackathons/${id}/submissions`,
         );
         setSubmissions(submissionsRes.data || []);
       } catch (_submErr) {
         // Non-participants get 403 — that's expected, just show no submissions
         setSubmissions([]);
       }
    } catch (error) {
      toast.error('Failed to load hackathon details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setActionLoading(true);
    try {
      await apiRequest(`/api/v1/hackathons/${id}/teams`, {
        method: 'POST',
        body: JSON.stringify({ name: teamName, hackathonId: id }),
      });
      toast.success('Team created!');
      setTeamName('');
      fetchData(); // Refresh to see new team
    } catch (error) {
      toast.error('Failed to create team');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setActionLoading(true);
    try {
      const matchingTeam = teams.find(t => t.invite_code === joinCode.trim());
      if (!matchingTeam) {
        toast.error('No team found with that invite code');
        return;
      }
      await apiRequest(`/api/v1/hackathons/${id}/teams/${matchingTeam.id}/join`, {
        method: 'POST',
        body: JSON.stringify({ inviteCode: joinCode.trim() }),
      });
      toast.success('Joined team!');
      setJoinCode('');
      fetchData();
    } catch (error) {
      toast.error('Failed to join team');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveTeam = async (teamId: string) => {
    if (!id || !user || !confirm('Are you sure you want to leave this team?')) return;
    setActionLoading(true);
    try {
      await apiRequest(`/api/v1/hackathons/${id}/teams/${teamId}/members/${user.id}`, {
        method: 'DELETE',
      });
      toast.success('Left team');
      fetchData();
    } catch (error) {
      toast.error('Failed to leave team');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString() + ' ' + new Date(dateStr).toLocaleTimeString();
  };

  // Find my team by checking the members array
  const myTeam = teams.find(t => t.members?.some(m => m.user_id === user?.id));

  const mySubmission = myTeam ? submissions.find(s => s.team_id === myTeam.id) : null;

  // Remove invalid error rendering block
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!hackathon) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <div className="max-w-lg w-full p-8 rounded-xl border border-red-500 bg-red-900/20">
          <h2 className="text-2xl font-bold mb-4 text-red-400">Error</h2>
          <p className="mb-6 text-red-200">Failed to load hackathon details. Please check your connection or try again later.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }
  if (CustomPage && hackathon) {
    return (
      <ErrorBoundary>
        <CustomPage hackathon={hackathon} />
      </ErrorBoundary>
    );
  }

  // derive accent color (fallback to neon green)
  const accent = hackathon.primary_color ?? '#CCFF00';

  return (
    <div className="space-y-6">
      {/* Top bar: Back + quick actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 text-white/80" />
            </Link>
          </Button>
          <div>
            <div className="text-xs text-white/40">Hackathon</div>
            <div className="text-lg font-semibold text-white">{hackathon.title}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={openRules} onOpenChange={setOpenRules}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-2" /> Rules</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rules — {hackathon.title}</DialogTitle>
                <DialogDescription>Official rules and judging criteria.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 text-sm text-muted-foreground">(Rules content can be edited by organizers)</div>
              <DialogFooter>
                <Button onClick={() => setOpenRules(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={openSchedule} onOpenChange={setOpenSchedule}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Calendar className="h-4 w-4 mr-2" /> Schedule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule — {hackathon.title}</DialogTitle>
                <DialogDescription>Important dates and timeline</DialogDescription>
              </DialogHeader>
              <div className="mt-4 text-sm text-muted-foreground">
                <ul className="list-disc pl-5 space-y-2">
                  <li>Registration opens: {formatDate(hackathon.registration_opens)}</li>
                  <li>Registration closes: {formatDate(hackathon.registration_closes)}</li>
                  <li>Submission deadline: {formatDate(hackathon.submission_deadline)}</li>
                </ul>
              </div>
              <DialogFooter>
                <Button onClick={() => setOpenSchedule(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={openRegister} onOpenChange={setOpenRegister}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ background: accent, color: '#000' }}><Ticket className="h-4 w-4 mr-2" /> Register</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register for {hackathon.title}</DialogTitle>
                <DialogDescription>Join as a participant or create a team.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 text-sm">
                <p className="text-muted-foreground">Click below to create a team or use an invite code to join an existing team.</p>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => { setOpenRegister(false); /* focus/create flow in-page */ }}>Create a Team</Button>
                  <Button variant="outline" onClick={() => { setOpenRegister(false); /* scroll to join form */ }}>Join with Code</Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setOpenRegister(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Hero with per-hackathon theme (updated visuals + content) */}
      <div
        className="rounded-2xl overflow-hidden p-6"
        style={{
          border: '1px solid rgba(255,255,255,0.04)',
          background: hackathon.banner_r2_key
            ? `linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url('/r2/${hackathon.banner_r2_key}') center/cover no-repeat`
            : `linear-gradient(135deg, ${accent}10 0%, #00000000 60%)`,
        }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight" style={{ color: accent }}>{hackathon.title}</h1>
            <p className="mt-4 text-lg text-white/80 max-w-3xl">{hackathon.description || 'No description provided.'}</p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${accent}22`, color: accent }}>
                {hackathon.status.replace('_', ' ')}
              </span>
              <span className="text-sm text-white/60">Max team size: <strong className="text-white/90">{hackathon.max_team_size}</strong></span>
              <span className="ml-2 text-sm text-white/60">Prizes: <strong className="text-white/90">$10,000</strong></span>
            </div>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            {hackathon.logo_r2_key ? (
              <img src={`/r2/${hackathon.logo_r2_key}`} alt="logo" className="h-28 w-28 rounded-lg object-cover border border-white/6" />
            ) : (
              <div className="h-28 w-28 rounded-lg bg-white/5 flex items-center justify-center text-2xl font-bold text-white/80">S</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{hackathon.description}</p>
            <div className="pt-4 space-y-1 text-sm">
              <div className="flex justify-between border-b py-1">
                <span>Registration Start:</span>
                <span className="font-medium">{formatDate(hackathon.registration_opens)}</span>
              </div>
              <div className="flex justify-between border-b py-1">
                <span>Registration Closes:</span>
                <span className="font-medium">{formatDate(hackathon.registration_closes)}</span>
              </div>
              <div className="flex justify-between border-b py-1">
                <span>Deadline:</span>
                <span className="font-medium">{formatDate(hackathon.submission_deadline)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic site / theme details for this hackathon */}
        <Card>
          <CardHeader>
            <CardTitle>Site / Theme</CardTitle>
            <CardDescription>Basic website details for this hackathon</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Primary color</p>
                <p className="font-medium mt-1">{hackathon.primary_color ?? '—'}</p>
              </div>
              <div className="h-8 w-8 rounded bg-white/5 border" style={{ background: hackathon.primary_color ?? '#111' }} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Banner</p>
                <p className="font-medium mt-1">{hackathon.banner_r2_key ? 'Uploaded' : 'None'}</p>
              </div>
              <div className="h-8 w-12 rounded bg-white/5 flex items-center justify-center text-xs text-white/50">
                {hackathon.banner_r2_key ? 'Yes' : '—'}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Logo</p>
                <p className="font-medium mt-1">{hackathon.logo_r2_key ? 'Uploaded' : 'None'}</p>
              </div>
              <div className="h-8 w-8 rounded bg-white/5 flex items-center justify-center">{hackathon.logo_r2_key ? '✔' : '—'}</div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Theme preview</p>
              <div className="mt-2 h-12 w-full rounded" style={{ background: `linear-gradient(90deg, ${accent}10, transparent)` }} />
            </div>
          </CardContent>
        </Card>

         {/* Participant: Team Actions */}
         {user && (
           <Card>
            <CardHeader>
              <CardTitle>My Team</CardTitle>
            </CardHeader>
            <CardContent>
              {myTeam ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold">{myTeam.name}</h3>
                    <p className="text-sm text-muted-foreground">Joined as {myTeam.members?.some(m => m.user_id === user?.id && m.role === 'leader') ? 'Captain' : 'Member'}</p>
                  </div>
                  
                  {mySubmission ? (
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm font-medium">Submission Received</p>
                      <p className="text-xs font-mono">{mySubmission.tag_name}</p>
                      <Badge variant="outline" className="mt-1">{mySubmission.status}</Badge>
                    </div>
                  ) : (
                     <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">No submission yet.</p>
                     </div>
                  )}

                  <div className="flex gap-2">
                    <Button asChild className="flex-1">
                      <Link to={`/hackathons/${id}/teams`}>Manage Team</Link>
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => handleLeaveTeam(myTeam.id)}
                      disabled={actionLoading}
                    >
                      Leave
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Create Team */}
                  <form onSubmit={handleCreateTeam} className="space-y-2">
                    <p className="text-sm font-medium">Create a new team</p>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Team Name" 
                        value={teamName} 
                        onChange={e => setTeamName(e.target.value)} 
                        required
                      />
                      <Button type="submit" disabled={actionLoading}>Create</Button>
                    </div>
                  </form>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                  </div>
                  {/* Join Team */}
                  <form onSubmit={handleJoinTeam} className="space-y-2">
                    <p className="text-sm font-medium">Join existing team</p>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Join Code" 
                        value={joinCode} 
                        onChange={e => setJoinCode(e.target.value)} 
                        required
                      />
                      <Button type="submit" variant="secondary" disabled={actionLoading}>Join</Button>
                    </div>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>


    </div>
  );
}
