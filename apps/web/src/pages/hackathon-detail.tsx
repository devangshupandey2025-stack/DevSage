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

// Local interfaces matching snake_case API response
interface Hackathon {
  id: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'REGISTRATION_OPEN' | 'HACKING' | 'SUBMISSION_CLOSED' | 'COMPLETED';
  registration_start_date: string;
  hacking_start_date: string;
  submission_deadline: string;
  max_team_size: number;
  organiser_id: string;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: string;
  hackathon_id: string;
  name: string;
  join_code: string;
  captain_id: string;
  created_at: string;
  member_count?: number; // From list endpoint
  members?: { user_id: string }[]; // Optional if list returns it
}

interface Submission {
  id: string;
  hackathon_id: string;
  team_id: string;
  repo_full_name: string;
  commit_sha: string;
  submitted_at: string;
  status: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface ListResponse<T> {
  data: T[];
  total: number;
}

export function HackathonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [registrations, setRegistrations] = useState<User[]>([]); // Organiser only
  const [loading, setLoading] = useState(true);
  
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
      // Parallel fetch
      const promises: Promise<any>[] = [
        apiRequest<Hackathon>(`/hackathons/${id}`),
        apiRequest<ListResponse<Team>>(`/hackathons/${id}/teams`),
      ];

       // Fetch submissions (available to all users)
       promises.push(apiRequest<Submission[]>(`/hackathons/${id}/submissions`));

       const results = await Promise.all(promises);
       setHackathon(results[0]);
       setTeams(results[1].data);
       setSubmissions(results[2] || []);
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
      await apiRequest(`/hackathons/${id}/teams`, {
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
      await apiRequest(`/hackathons/${id}/teams/join`, {
        method: 'POST',
        body: JSON.stringify({ joinCode }),
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
    if (!id || !confirm('Are you sure you want to leave this team?')) return;
    setActionLoading(true);
    try {
      await apiRequest(`/hackathons/${id}/teams/${teamId}/leave`, {
        method: 'POST',
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

  // Find my team: check captain_id OR if members list exists and I'm in it
  // Note: The list endpoint might not return members for all teams for participants
  // But for the user's OWN team, maybe it does? Or we just assume captain for now.
  // Ideally we'd have a better way, but for MVP:
  const myTeam = teams.find(t => t.captain_id === user?.id) 
    || teams.find(t => t.members?.some(m => m.user_id === user?.id));

  const mySubmission = myTeam ? submissions.find(s => s.team_id === myTeam.id) : null;

  if (loading || !hackathon) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{hackathon.title}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/hackathons/${id}/leaderboard`}>Leaderboard</Link>
          </Button>
          <Badge variant={hackathon.status === 'HACKING' ? 'default' : 'secondary'}>
            {hackathon.status.replace('_', ' ')}
          </Badge>
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
                <span className="font-medium">{formatDate(hackathon.registration_start_date)}</span>
              </div>
              <div className="flex justify-between border-b py-1">
                <span>Hacking Start:</span>
                <span className="font-medium">{formatDate(hackathon.hacking_start_date)}</span>
              </div>
              <div className="flex justify-between border-b py-1">
                <span>Deadline:</span>
                <span className="font-medium">{formatDate(hackathon.submission_deadline)}</span>
              </div>
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
                    <p className="text-sm text-muted-foreground">Joined as {myTeam.captain_id === user?.id ? 'Captain' : 'Member'}</p>
                  </div>
                  
                  {mySubmission ? (
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm font-medium">Submission Received</p>
                      <p className="text-xs font-mono">{mySubmission.repo_full_name}</p>
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

       {/* Organiser: Management Views */}
       {false && (
         <Tabs defaultValue="teams" className="w-full">
          <TabsList>
            <TabsTrigger value="teams">Teams ({teams.length})</TabsTrigger>
            <TabsTrigger value="submissions">Submissions ({submissions.length})</TabsTrigger>
            <TabsTrigger value="registrations">Registrations ({registrations.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="teams" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teams.map(team => (
                <Card key={team.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <CardDescription>Created {new Date(team.created_at).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">Members: {team.member_count ?? '?'}</p>
                    <p className="text-sm">Captain ID: {team.captain_id.substring(0, 8)}...</p>
                  </CardContent>
                  <CardFooter>
                    <Button asChild size="sm" variant="outline" className="w-full">
                       <Link to={`/hackathons/${id}/teams`}>View Details</Link>
                       {/* Note: In real app, might want specific team detail link for organiser, but reusing team management page for now if it supports view only */}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              {teams.length === 0 && <p className="text-muted-foreground">No teams yet.</p>}
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="mt-4">
             <div className="space-y-4">
               {submissions.map(sub => (
                 <Card key={sub.id}>
                   <CardHeader className="pb-2">
                     <div className="flex justify-between">
                        <CardTitle className="text-base font-mono">{sub.repo_full_name}</CardTitle>
                        <Badge>{sub.status}</Badge>
                     </div>
                   </CardHeader>
                   <CardContent className="text-sm text-muted-foreground">
                      Commit: <span className="font-mono text-foreground">{sub.commit_sha.substring(0, 7)}</span>
                      <br />
                      Submitted: {formatDate(sub.submitted_at)}
                   </CardContent>
                 </Card>
               ))}
               {submissions.length === 0 && <p className="text-muted-foreground">No submissions yet.</p>}
             </div>
          </TabsContent>

          <TabsContent value="registrations" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <ul className="space-y-2">
                  {registrations.map(reg => (
                    <li key={reg.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{reg.name}</p>
                        <p className="text-sm text-muted-foreground">{reg.email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{reg.id.substring(0, 8)}...</span>
                    </li>
                  ))}
                  {registrations.length === 0 && <p className="text-muted-foreground">No registrations yet.</p>}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
