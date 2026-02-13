import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Github, LogOut, ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Team {
  id: string;
  hackathon_id: string;
  name: string;
  join_code: string;
  captain_id: string;
  created_at: string;
  members: Array<{ 
    user_id: string; 
    joined_at: string; 
    user: { 
      id: string; 
      name: string; 
      email: string; 
      avatar_url: string | null 
    } 
  }>;
  repo_full_name?: string;
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

interface ListResponse<T> {
  data: T[];
  total: number;
}

export function TeamManagementPage() {
  const { slug } = useParams<{ slug: string }>();
  const id = slug; // route uses :slug
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [repoUrl, setRepoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const findAndLoadTeam = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const teamsResponse = await apiRequest<ListResponse<Partial<Team>>>(`/api/v1/hackathons/${id}/teams`);
      const myTeam = teamsResponse.data.find((t: any) => 
        t.captain_id === user?.id || 
        t.members?.some((m: any) => m.user_id === user?.id)
      );

      if (!myTeam || !myTeam.id) {
        toast.error("You are not in a team for this hackathon");
        navigate(`/hackathons/${id}`);
        return;
      }

      const teamDetails = await apiRequest<Team>(`/api/v1/hackathons/${id}/teams/${myTeam.id}`);
      setTeam(teamDetails);
      
      if (teamDetails.repo_full_name) {
        setRepoUrl(teamDetails.repo_full_name);
      }

      try {
        const submissions = await apiRequest<Submission[]>(`/api/v1/hackathons/${id}/submissions`);
        const mySubmission = submissions.find(s => s.team_id === myTeam.id);
        if (mySubmission) {
          setSubmission(mySubmission);
        }
      } catch (e) {
        console.error("Failed to fetch submissions", e);
      }

    } catch (error) {
      toast.error('Failed to load team details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, user, navigate]);

  useEffect(() => {
    findAndLoadTeam();
  }, [findAndLoadTeam]);

  const handleCopyCode = () => {
    if (team?.join_code) {
      navigator.clipboard.writeText(team.join_code);
      toast.success('Join code copied to clipboard');
    }
  };

  const handleLinkRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !team) return;
    
    if (!repoUrl.includes('/') || repoUrl.trim().split('/').length !== 2) {
      toast.error('Please use "owner/repo" format (e.g. devsage/hackathon-project)');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest(`/api/v1/hackathons/${id}/teams/${team.id}/repo`, {
        method: 'POST',
        body: JSON.stringify({ repoFullName: repoUrl.trim() }),
      });
      toast.success('Repository linked successfully!');
      findAndLoadTeam();
    } catch (error) {
      toast.error('Failed to link repository');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!id || !team || !confirm('Are you sure you want to leave this team?')) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/v1/hackathons/${id}/teams/${team.id}/leave`, {
        method: 'POST',
      });
      toast.success('Left team');
      navigate(`/hackathons/${id}`);
    } catch (error) {
      toast.error('Failed to leave team');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 container mx-auto py-8 max-w-4xl">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!team) return null;

  const isCaptain = team.captain_id === user?.id;

  return (
    <div className="space-y-8 container mx-auto py-8 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/hackathons/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
          <p className="text-muted-foreground">Manage your team settings and members</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {team.members?.length || 0} members in this team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {team.members?.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs overflow-hidden">
                        {member.user.avatar_url ? (
                          <img src={member.user.avatar_url} alt={member.user.name} className="h-full w-full object-cover" />
                        ) : (
                          member.user.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{member.user.name}</p>
                        <p className="text-xs text-muted-foreground">{member.user.email}</p>
                      </div>
                    </div>
                    {member.user_id === team.captain_id && (
                      <Badge variant="secondary">Captain</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
             <CardHeader>
                <CardTitle>Project Submission</CardTitle>
                <CardDescription>Link your GitHub repository to submit your project</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               {submission && (
                 <div className="bg-muted p-4 rounded-lg flex items-start gap-3">
                    <div className="mt-1"><Github className="h-5 w-5" /></div>
                    <div className="space-y-1 flex-1">
                      <div className="flex justify-between">
                         <p className="font-medium text-sm">Latest Submission</p>
                         <Badge variant={submission.status === 'success' ? 'default' : 'outline'}>{submission.status}</Badge>
                      </div>
                      <p className="text-xs font-mono">{submission.repo_full_name}</p>
                      <p className="text-xs text-muted-foreground">Commit: {submission.commit_sha.substring(0, 7)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(submission.submitted_at).toLocaleString()}</p>
                    </div>
                 </div>
               )}

               {isCaptain ? (
                 <form onSubmit={handleLinkRepo} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="repo-url" className="text-sm font-medium">Repository (owner/repo)</label>
                      <div className="flex gap-2">
                        <Input 
                          id="repo-url"
                          placeholder="e.g. facebook/react" 
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                        />
                        <Button type="submit" disabled={submitting}>
                          {submission ? 'Update' : 'Link'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Make sure the repository is public or the system has access.
                      </p>
                    </div>
                 </form>
               ) : (
                 <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
                   Only the team captain can link a repository.
                 </div>
               )}
             </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invite Members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                 <p className="text-xs font-medium text-muted-foreground">JOIN CODE</p>
                 <div className="flex gap-2">
                   <code className="flex-1 bg-muted rounded px-3 py-2 text-sm font-mono flex items-center">
                     {team.join_code}
                   </code>
                   <Button variant="outline" size="icon" onClick={handleCopyCode}>
                     <Copy className="h-4 w-4" />
                   </Button>
                 </div>
                 <p className="text-xs text-muted-foreground">
                   Share this code with teammates to let them join.
                 </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                className="w-full" 
                onClick={handleLeaveTeam}
                disabled={submitting}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Leave Team
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
