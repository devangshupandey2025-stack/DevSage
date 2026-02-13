import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Trophy, Medal, Github } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Hackathon {
  id: string;
  title: string;
  description: string;
  status: string;
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

interface Team {
  id: string;
  hackathon_id: string;
  name: string;
  join_code: string;
  captain_id: string;
  created_at: string;
  member_count?: number;
}

interface ListResponse<T> {
  data: T[];
  total: number;
}

export function LeaderboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const promises = [
          apiRequest<Hackathon>(`/api/v1/hackathons/${slug}`),
          apiRequest<ListResponse<Team>>(`/api/v1/hackathons/${slug}/teams`),
          apiRequest<Submission[]>(`/api/v1/hackathons/${slug}/submissions`),
        ];

        const [hackathonData, teamsData, submissionsData] = await Promise.all(promises) as [Hackathon, ListResponse<Team>, Submission[]];

        setHackathon(hackathonData);
        
        const teamMap: Record<string, Team> = {};
        teamsData.data.forEach(team => {
          teamMap[team.id] = team;
        });
        setTeams(teamMap);

        const sortedSubmissions = (submissionsData || []).sort((a, b) => 
          new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
        );
        setSubmissions(sortedSubmissions);

      } catch (error) {
        toast.error('Failed to load leaderboard data');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchData();
    }
  }, [slug]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="font-mono font-bold text-muted-foreground">#{index + 1}</span>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-1/3" />
        </div>
        <Skeleton className="h-100 w-full" />
      </div>
    );
  }

  if (!hackathon) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/hackathons/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{hackathon.title}</h2>
          <p className="text-muted-foreground">Leaderboard & Results</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No submissions yet.</p>
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-25">Rank</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Team</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Repository</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Submitted At</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {submissions.map((submission, index) => {
                    const team = teams[submission.team_id];
                    return (
                      <tr key={submission.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle font-medium">
                          <div className="flex items-center justify-center w-8">
                            {getRankIcon(index)}
                          </div>
                        </td>
                        <td className="p-4 align-middle font-medium">
                          {team ? team.name : 'Unknown Team'}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-2">
                            <Github className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-xs">{submission.repo_full_name}</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <Badge variant={submission.status === 'success' ? 'default' : 'secondary'}>
                            {submission.status}
                          </Badge>
                        </td>
                        <td className="p-4 align-middle text-right text-muted-foreground">
                          {formatDate(submission.submitted_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
