import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Trophy, 
  Users, 
  Gavel, 
  Settings, 
  Plus, 
  Trash2, 
  Save, 
  UserPlus, 
  AlertTriangle,
  Play
} from 'lucide-react';

type HackathonStatus = 'draft' | 'active' | 'judging' | 'completed' | 'archived';

interface Hackathon {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: HackathonStatus;
  starts_at: string | null;
  submission_deadline: string | null;
  judging_starts: string | null;
  judging_ends: string | null;
  min_team_size: number;
  max_team_size: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
}

interface Judge {
  id: string;
  hackathon_id: string;
  user_id: string;
  invite_status: 'pending' | 'accepted' | 'declined';
  invited_at: string;
  accepted_at: string | null;
  user: User;
}

interface RubricItem {
  id?: string;
  tempId?: string;
  hackathon_id?: string;
  name: string;
  description: string;
  max_score: number;
  weight: number;
  sort_order: number;
}

interface LeaderboardItem {
  team_id: string;
  team_name: string;
  weighted_percentage: number;
  judges_completed: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Hacking Active",
  judging: "Judging",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500",
  active: "bg-green-500",
  judging: "bg-purple-500",
  completed: "bg-indigo-500",
  archived: "bg-slate-700",
};

const NEXT_STATUS: Record<string, string> = {
  draft: "active",
  active: "judging",
  judging: "completed",
  completed: "archived",
};

const NEXT_PHASE_LABEL: Record<string, string> = {
  draft: "Activate",
  active: "Start Judging",
  judging: "Complete",
  completed: "Archive",
};

export function HackathonManagePage() {
  const { slug } = useParams<{ slug: string }>();
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchHackathon = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await apiRequest<{ data: Hackathon }>(`/api/v1/hackathons/${slug}`);
      setHackathon(res.data);
    } catch (error) {
      console.error("Failed to fetch hackathon", error);
      toast.error("Failed to load hackathon details");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchHackathon();
  }, [fetchHackathon]);

  const handlePhaseTransition = async () => {
    if (!hackathon || !slug) return;
    
    const targetStatus = NEXT_STATUS[hackathon.status];
    if (!targetStatus) return;

    try {
      await apiRequest(`/api/v1/hackathons/${slug}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_status: targetStatus, version: 0 }),
      });

      toast.success(`Transitioned to ${NEXT_PHASE_LABEL[hackathon.status]}`);
      fetchHackathon();
    } catch (error) {
      console.error("Transition failed", error);
      toast.error("Failed to transition phase");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold text-white">Hackathon not found</h1>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-7xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Link to="/dashboard" className="hover:text-[#CCFF00] transition-colors flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{hackathon.title}</h1>
          <div className="flex items-center gap-2">
            <Badge className={`${STATUS_COLORS[hackathon.status]} text-white border-none`}>
              {STATUS_LABELS[hackathon.status]}
            </Badge>
            <span className="text-sm text-white/40 font-mono">/{hackathon.slug}</span>
          </div>
        </div>
        
        {NEXT_STATUS[hackathon.status] && (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-[#CCFF00] text-black hover:bg-[#b3e600] font-medium">
                {NEXT_PHASE_LABEL[hackathon.status]} <Play className="ml-2 h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Advance Phase</DialogTitle>
                <DialogDescription className="text-white/60">
                  Are you sure you want to advance the hackathon phase? This action cannot be undone easily.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={handlePhaseTransition} className="bg-[#CCFF00] text-black hover:bg-[#b3e600]">
                  Confirm Transition
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#CCFF00] data-[state=active]:text-black text-white/60">
            <Settings className="mr-2 h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="judges" className="data-[state=active]:bg-[#CCFF00] data-[state=active]:text-black text-white/60">
            <Gavel className="mr-2 h-4 w-4" /> Judges
          </TabsTrigger>
          <TabsTrigger value="rubric" className="data-[state=active]:bg-[#CCFF00] data-[state=active]:text-black text-white/60">
            <Trophy className="mr-2 h-4 w-4" /> Rubric
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="data-[state=active]:bg-[#CCFF00] data-[state=active]:text-black text-white/60">
            <Users className="mr-2 h-4 w-4" /> Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab hackathon={hackathon} />
        </TabsContent>

        <TabsContent value="judges" className="space-y-6">
          <JudgesTab hackathon={hackathon} />
        </TabsContent>

        <TabsContent value="rubric" className="space-y-6">
          <RubricTab hackathon={hackathon} />
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-6">
          <LeaderboardTab hackathon={hackathon} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ hackathon }: { hackathon: Hackathon }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="bg-white/5 border-white/10 text-white">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-white/60">Description</h3>
            <p className="mt-1 text-sm">{hackathon.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-white/60">Min Team Size</h3>
              <p className="mt-1 text-lg font-mono">{hackathon.min_team_size}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/60">Max Team Size</h3>
              <p className="mt-1 text-lg font-mono">{hackathon.max_team_size}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 text-white">
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hackathon.starts_at && <TimelineItem label="Starts At" date={hackathon.starts_at} />}
          {hackathon.submission_deadline && <TimelineItem label="Submission Deadline" date={hackathon.submission_deadline} />}
          {hackathon.judging_starts && <TimelineItem label="Judging Starts" date={hackathon.judging_starts} />}
          {hackathon.judging_ends && <TimelineItem label="Judging Ends" date={hackathon.judging_ends} />}
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineItem({ label, date }: { label: string, date: string }) {
  return (
    <div className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-sm font-mono">{new Date(date).toLocaleString()}</span>
    </div>
  );
}

function JudgesTab({ hackathon }: { hackathon: Hackathon }) {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const fetchJudges = useCallback(async () => {
    try {
      const res = await apiRequest<{ data: Judge[] }>(`/api/v1/hackathons/${hackathon.slug}/judges`);
      setJudges(res.data);
    } catch (error) {
      console.error("Failed to fetch judges", error);
    } finally {
      setLoading(false);
    }
  }, [hackathon.slug]);

  useEffect(() => {
    fetchJudges();
  }, [fetchJudges]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUserId.trim()) return;
    
    setInviting(true);
    try {
      await apiRequest(`/api/v1/hackathons/${hackathon.slug}/judges`, {
        method: 'POST',
        body: JSON.stringify({ userId: inviteUserId }),
      });
      toast.success("Judge invited successfully");
      setInviteUserId("");
      fetchJudges();
    } catch (error) {
      console.error("Failed to invite judge", error);
      toast.error("Failed to invite judge");
    } finally {
      setInviting(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!confirm("This will distribute all submissions evenly among accepted judges. Continue?")) return;
    
    setAssigning(true);
    try {
      await apiRequest(`/api/v1/hackathons/${hackathon.slug}/judges/assign`, {
        method: 'POST',
      });
      toast.success("Judges assigned successfully");
    } catch (error) {
      console.error("Failed to assign judges", error);
      toast.error("Failed to assign judges");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10 text-white">
        <CardHeader>
          <CardTitle>Manage Judges</CardTitle>
          <CardDescription className="text-white/60">Invite judges and manage assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label htmlFor="invite-user-id" className="text-sm font-medium text-white/80">User ID</label>
              <Input 
                id="invite-user-id"
                value={inviteUserId} 
                onChange={(e) => setInviteUserId(e.target.value)} 
                placeholder="Enter user UUID..." 
                className="bg-black/20 border-white/10 text-white"
              />
            </div>
            <Button type="submit" disabled={inviting} className="bg-[#CCFF00] text-black hover:bg-[#b3e600]">
              {inviting ? "Inviting..." : <><UserPlus className="mr-2 h-4 w-4" /> Invite Judge</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {hackathon.status === 'judging' && (
        <div className="flex justify-end">
          <Button onClick={handleAutoAssign} disabled={assigning} variant="outline" className="border-white/20 text-white hover:bg-white/10">
            {assigning ? "Assigning..." : "Auto-Assign Judges"}
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : judges.length === 0 ? (
          <div className="col-span-full text-center py-10 text-white/40 border border-dashed border-white/10 rounded-lg">
            No judges invited yet.
          </div>
        ) : (
          judges.map((judge) => (
            <Card key={judge.id} className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                    {judge.user.avatar_url ? (
                      <img src={judge.user.avatar_url} alt={judge.user.display_name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold">{judge.user.display_name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{judge.user.display_name}</p>
                    <p className="text-xs text-white/40 truncate max-w-[150px]">{judge.user.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`
                  ${judge.invite_status === 'accepted' ? 'border-green-500/50 text-green-400' : 
                    judge.invite_status === 'declined' ? 'border-red-500/50 text-red-400' : 
                    'border-yellow-500/50 text-yellow-400'}
                `}>
                  {judge.invite_status}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function RubricTab({ hackathon }: { hackathon: Hackathon }) {
  const [criteria, setCriteria] = useState<RubricItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isEditable = hackathon.status === 'draft';

  const fetchRubric = useCallback(async () => {
    try {
      const res = await apiRequest<{ data: RubricItem[] }>(`/api/v1/hackathons/${hackathon.slug}/rubric`);
      const sorted = (res.data || []).sort((a, b) => a.sort_order - b.sort_order);
      setCriteria(sorted);
    } catch (error) {
      console.error("Failed to fetch rubric", error);
    } finally {
      setLoading(false);
    }
  }, [hackathon.slug]);

  useEffect(() => {
    fetchRubric();
  }, [fetchRubric]);

  const handleAddCriteria = () => {
    setCriteria([
      ...criteria,
      {
        tempId: crypto.randomUUID(),
        name: "",
        description: "",
        max_score: 10,
        weight: 1,
        sort_order: criteria.length,
      }
    ]);
  };

  const handleRemoveCriteria = (index: number) => {
    const newCriteria = [...criteria];
    newCriteria.splice(index, 1);
    setCriteria(newCriteria);
  };

  const handleChange = (index: number, field: keyof RubricItem, value: any) => {
    const newCriteria = [...criteria];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    setCriteria(newCriteria);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = criteria.map((c, i) => ({
        name: c.name,
        description: c.description,
        maxScore: Number(c.max_score),
        weight: Number(c.weight),
        sortOrder: i
      }));

      await apiRequest(`/api/v1/hackathons/${hackathon.slug}/rubric`, {
        method: 'POST',
        body: JSON.stringify({ criteria: payload }),
      });
      
      toast.success("Rubric saved successfully");
      fetchRubric();
    } catch (error) {
      console.error("Failed to save rubric", error);
      toast.error("Failed to save rubric");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-[400px] w-full" />;

  return (
    <div className="space-y-6">
      {!isEditable && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center gap-3 text-yellow-200">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-sm">Rubric cannot be modified after registration closes.</p>
        </div>
      )}

      <div className="space-y-4">
        {criteria.map((item, index) => (
          <Card key={item.id || item.tempId || index} className="bg-white/5 border-white/10 text-white relative group">
            <CardContent className="pt-6 grid gap-4 md:grid-cols-12 items-start">
              <div className="md:col-span-4 space-y-2">
                <label htmlFor={`criteria-name-${index}`} className="text-xs font-medium text-white/60">Criteria Name</label>
                <Input 
                  id={`criteria-name-${index}`}
                  value={item.name} 
                  onChange={(e) => handleChange(index, 'name', e.target.value)}
                  disabled={!isEditable}
                  placeholder="e.g. Innovation"
                  className="bg-black/20 border-white/10 text-white"
                />
              </div>
              <div className="md:col-span-4 space-y-2">
                <label htmlFor={`criteria-desc-${index}`} className="text-xs font-medium text-white/60">Description</label>
                <textarea 
                  id={`criteria-desc-${index}`}
                  value={item.description} 
                  onChange={(e) => handleChange(index, 'description', e.target.value)}
                  disabled={!isEditable}
                  placeholder="Description for judges..."
                  className="flex min-h-[40px] w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
                  rows={1}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label htmlFor={`criteria-score-${index}`} className="text-xs font-medium text-white/60">Max Score</label>
                <Input 
                  id={`criteria-score-${index}`}
                  type="number"
                  value={item.max_score} 
                  onChange={(e) => handleChange(index, 'max_score', e.target.value)}
                  disabled={!isEditable}
                  className="bg-black/20 border-white/10 text-white"
                />
              </div>
              <div className="md:col-span-1 space-y-2">
                <label htmlFor={`criteria-weight-${index}`} className="text-xs font-medium text-white/60">Weight</label>
                <Input 
                  id={`criteria-weight-${index}`}
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={item.weight} 
                  onChange={(e) => handleChange(index, 'weight', e.target.value)}
                  disabled={!isEditable}
                  className="bg-black/20 border-white/10 text-white"
                />
              </div>
              <div className="md:col-span-1 flex items-end justify-end h-full pb-1">
                {isEditable && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveCriteria(index)}
                    className="text-white/40 hover:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {criteria.length === 0 && (
          <div className="text-center py-10 text-white/40 border border-dashed border-white/10 rounded-lg">
            No rubric criteria defined.
          </div>
        )}
      </div>

      {isEditable && (
        <div className="flex justify-between pt-4 border-t border-white/10">
          <Button onClick={handleAddCriteria} variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <Plus className="mr-2 h-4 w-4" /> Add Criteria
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#CCFF00] text-black hover:bg-[#b3e600]">
            {saving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Rubric</>}
          </Button>
        </div>
      )}
    </div>
  );
}

function LeaderboardTab({ hackathon }: { hackathon: Hackathon }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await apiRequest<{ data: LeaderboardItem[] }>(`/api/v1/hackathons/${hackathon.slug}/leaderboard`);
      setLeaderboard(res.data || []);
    } catch (error) {
      console.error("Failed to fetch leaderboard", error);
    } finally {
      setLoading(false);
    }
  }, [hackathon.slug]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  if (loading) return <Skeleton className="h-[400px] w-full" />;

  return (
    <Card className="bg-white/5 border-white/10 text-white">
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription className="text-white/60">Current standings based on weighted judge scores.</CardDescription>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <div className="text-center py-10 text-white/40">
            No scores recorded yet.
          </div>
        ) : (
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm text-left">
              <thead className="[&_tr]:border-b [&_tr]:border-white/10">
                <tr className="border-b border-white/10 transition-colors hover:bg-white/5 data-[state=selected]:bg-white/10">
                  <th className="h-12 px-4 align-middle font-medium text-white/60">Rank</th>
                  <th className="h-12 px-4 align-middle font-medium text-white/60">Team</th>
                  <th className="h-12 px-4 align-middle font-medium text-white/60 text-right">Judges</th>
                  <th className="h-12 px-4 align-middle font-medium text-white/60 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {leaderboard.map((item, index) => (
                  <tr key={item.team_id} className="border-b border-white/10 transition-colors hover:bg-white/5">
                    <td className="p-4 align-middle font-medium">
                      {index === 0 ? <Trophy className="h-5 w-5 text-yellow-400" /> : 
                       index === 1 ? <Trophy className="h-5 w-5 text-gray-400" /> : 
                       index === 2 ? <Trophy className="h-5 w-5 text-amber-600" /> : 
                       `#${index + 1}`}
                    </td>
                    <td className="p-4 align-middle">{item.team_name}</td>
                    <td className="p-4 align-middle text-right">{item.judges_completed}</td>
                    <td className="p-4 align-middle text-right font-mono text-[#CCFF00]">
                      {item.weighted_percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
