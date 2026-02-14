import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Github, LogOut, ArrowLeft, Tag, Info, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamMember {
  user_id: string;
  joined_at: string;
  display_name: string;
}

interface Team {
  id: string;
  hackathon_id: string;
  name: string;
  invite_code: string;
  repo_full_name: string | null;
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
  status: string;
}

interface PaginatedEnvelope<T> {
  ok: boolean;
  data: T[];
  meta: { total: number; limit: number; offset: number };
}

interface Envelope<T> {
  ok: boolean;
  data: T;
}

const SUBMISSION_STATUS_STYLES: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  received: { variant: 'outline', className: 'border-amber-500/50 text-amber-400' },
  validated: { variant: 'default', className: 'bg-green-600 text-white' },
  locked: { variant: 'secondary', className: 'bg-blue-600/20 text-blue-400 border-blue-500/50' },
  under_review: { variant: 'secondary', className: 'bg-purple-600/20 text-purple-400 border-purple-500/50' },
  scored: { variant: 'default', className: 'bg-green-600 text-white' },
  invalid: { variant: 'destructive' },
  invalidated: { variant: 'destructive' },
};

const POLL_INTERVAL_MS = 10_000;

export function TeamManagementPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [repoUrl, setRepoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const teamIdRef = useRef<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!slug || !teamIdRef.current) return;
    try {
      const res = await apiRequest<Envelope<Submission[]>>(
        `/api/v1/hackathons/${slug}/submissions/${teamIdRef.current}`,
      );
      const sorted = [...res.data].sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
      );
      setSubmissions(sorted);
    } catch (_e) {
      // Submissions endpoint may 403 for non-participants
    }
  }, [slug]);

  const findAndLoadTeam = useCallback(async () => {
    if (!slug || !user) return;
    setLoading(true);
    try {
      const teamsEnvelope = await apiRequest<PaginatedEnvelope<Team>>(`/api/v1/hackathons/${slug}/teams`);
      const teamsList = teamsEnvelope.data;

      const teamDetailPromises = teamsList.map((t) =>
        apiRequest<Envelope<Team & { members: TeamMember[] }>>(`/api/v1/hackathons/${slug}/teams/${t.id}`),
      );
      const teamDetails = await Promise.all(teamDetailPromises);

      let myTeam: (Team & { members: TeamMember[] }) | undefined;
      for (const detail of teamDetails) {
        const t = detail.data;
        if (t.members?.some((m) => m.user_id === user.id)) {
          myTeam = t;
          break;
        }
      }

      if (!myTeam) {
        toast.error('You are not in a team for this hackathon');
        navigate(`/hackathons/${slug}`);
        return;
      }

      setTeam(myTeam);
      teamIdRef.current = myTeam.id;
      
      if (myTeam.repo_full_name) {
        setRepoUrl(myTeam.repo_full_name);
      }

      await fetchSubmissions();
    } catch (_error) {
      toast.error('Failed to load team details');
    } finally {
      setLoading(false);
    }
  }, [slug, user, navigate, fetchSubmissions]);

  useEffect(() => {
    findAndLoadTeam();
  }, [findAndLoadTeam]);

  useEffect(() => {
    pollRef.current = setInterval(fetchSubmissions, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchSubmissions]);

  const handleCopyCode = () => {
    if (team?.invite_code) {
      navigator.clipboard.writeText(team.invite_code);
      toast.success('Invite code copied to clipboard');
    }
  };

  const handleLinkRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !team) return;
    
    if (!repoUrl.includes('/') || repoUrl.trim().split('/').length !== 2) {
      toast.error('Please use "owner/repo" format (e.g. devsage/hackathon-project)');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/teams/${team.id}/repo`, {
        method: 'POST',
        body: JSON.stringify({ repoFullName: repoUrl.trim() }),
      });
      toast.success('Repository linked successfully!');
      findAndLoadTeam();
    } catch (_error) {
      toast.error('Failed to link repository');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!slug || !team || !user || !confirm('Are you sure you want to leave this team?')) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/teams/${team.id}/members/${user.id}`, {
        method: 'DELETE',
      });
      toast.success('Left team');
      navigate(`/hackathons/${slug}`);
    } catch (_error) {
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

  const isFirstMember = team.members?.[0]?.user_id === user?.id;
  const hasRepo = Boolean(team.repo_full_name);
  const hasSubmissions = submissions.length > 0;
  const statusStyle = (status: string) =>
    SUBMISSION_STATUS_STYLES[status] ?? { variant: 'outline' as const };

  return (
    <div className="space-y-8 container mx-auto py-8 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/hackathons/${slug}`)}>
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
                {team.members?.length ?? 0} members in this team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {team.members?.map((member, idx) => (
                  <div key={member.user_id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                        {(member.display_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{member.display_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {idx === 0 && (
                      <Badge variant="secondary">Leader</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
             <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Project Submission</CardTitle>
                    <CardDescription>Link your GitHub repository and submit via git tags</CardDescription>
                  </div>
                  {hasSubmissions && (
                    <Button variant="ghost" size="icon" onClick={fetchSubmissions} title="Refresh submissions">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
             </CardHeader>
             <CardContent className="space-y-4">
               {hasSubmissions ? (
                 <div className="space-y-3">
                   {submissions.map((sub) => {
                     const style = statusStyle(sub.status);
                     return (
                       <div key={sub.id} className="bg-muted p-4 rounded-lg flex items-start gap-3">
                         <div className="mt-1"><Tag className="h-4 w-4 text-muted-foreground" /></div>
                         <div className="space-y-1 flex-1 min-w-0">
                           <div className="flex items-center justify-between gap-2">
                             <p className="font-mono text-sm truncate">{sub.tag_name}</p>
                             <Badge variant={style.variant} className={style.className}>
                               {sub.status}
                             </Badge>
                           </div>
                           <div className="flex items-center gap-3 text-xs text-muted-foreground">
                             <span className="font-mono">{sub.commit_sha.substring(0, 7)}</span>
                             <span>{new Date(sub.submitted_at).toLocaleString()}</span>
                           </div>
                         </div>
                       </div>
                     );
                   })}
                   <p className="text-xs text-muted-foreground flex items-center gap-1">
                     <RefreshCw className="h-3 w-3" />
                     Auto-refreshing every 10 seconds
                   </p>
                 </div>
               ) : hasRepo ? (
                 <div className="bg-muted/50 border border-dashed border-muted-foreground/20 rounded-lg p-6 text-center space-y-2">
                   <Github className="h-8 w-8 mx-auto text-muted-foreground" />
                   <p className="text-sm font-medium">No submissions yet</p>
                   <p className="text-xs text-muted-foreground">
                     Push a git tag to your linked repository to create a submission.
                   </p>
                   <Button variant="outline" size="sm" onClick={() => setShowGuide(true)} className="mt-2">
                     <Info className="h-3 w-3 mr-1" /> How to submit
                   </Button>
                 </div>
               ) : null}

               {(showGuide || (!hasRepo && !hasSubmissions)) && (
                 <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-4 space-y-3">
                   <div className="flex items-center justify-between">
                     <p className="text-sm font-medium text-blue-400 flex items-center gap-2">
                       <Info className="h-4 w-4" /> How to Submit
                     </p>
                     {showGuide && (
                       <Button variant="ghost" size="sm" onClick={() => setShowGuide(false)} className="h-6 px-2 text-xs">
                         Dismiss
                       </Button>
                     )}
                   </div>
                   <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                     <li>Link your GitHub repository using the form below (team leader only).</li>
                     <li>When ready to submit, push a git tag matching the submission pattern:
                       <code className="ml-1 bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">git tag submission-v1 && git push origin submission-v1</code>
                     </li>
                     <li>DevSage detects the tag via webhook and records your submission automatically.</li>
                     <li>Push additional tags (e.g. <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">submission-v2</code>) to update your submission.</li>
                   </ol>
                 </div>
               )}

               {isFirstMember ? (
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
                          {hasRepo ? 'Update' : 'Link'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Make sure the repository is public or the system has access.
                      </p>
                    </div>
                 </form>
               ) : (
                 <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
                   Only the team leader can link a repository.
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
                 <p className="text-xs font-medium text-muted-foreground">INVITE CODE</p>
                 <div className="flex gap-2">
                   <code className="flex-1 bg-muted rounded px-3 py-2 text-sm font-mono flex items-center">
                     {team.invite_code}
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
