import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, Trophy, Zap, ZapOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Hackathon {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
  starts_at: string | null;
  submission_deadline: string | null;
}

interface Round {
  id: string;
  hackathon_id: string;
  round_number: number;
  name: string;
  type: string;
  status: string;
  is_initialized: number;
  submission_deadline: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  upcoming: 'bg-white/10 text-white/60',
  pending: 'bg-white/10 text-white/60',
  active: 'bg-emerald-500/20 text-emerald-400',
  completed: 'bg-sky-500/20 text-sky-400',
};

export function HackathonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [roundsLoading, setRoundsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchHackathon = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiRequest<{ data: Hackathon }>(`/api/v1/admin/hackathons/${id}`);
      setHackathon(res.data);
    } catch {
      setHackathon(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchRounds = useCallback(async () => {
    if (!id) return;
    setRoundsLoading(true);
    try {
      const res = await apiRequest<{ data: Round[] }>(`/api/v1/admin/hackathons/${id}/rounds`);
      setRounds(res.data ?? []);
    } catch {
      setRounds([]);
    } finally {
      setRoundsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchHackathon();
    fetchRounds();
  }, [fetchHackathon, fetchRounds]);

  const toggleInitialization = async (round: Round) => {
    if (!id) return;
    setTogglingId(round.id);
    try {
      const newValue = !round.is_initialized;
      await apiRequest(`/api/v1/admin/hackathons/${id}/rounds/${round.id}/initialize`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_initialized: newValue }),
      });
      toast.success(newValue ? `Round "${round.name}" initialized — submissions are now open` : `Round "${round.name}" un-initialized — submissions closed`);
      fetchRounds();
    } catch {
      toast.error('Failed to update round initialization');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="space-y-6">
        <Link to="/hackathons" className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white transition">
          <ChevronLeft className="h-4 w-4" /> Back to Hackathons
        </Link>
        <p className="text-white/40">Hackathon not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link to="/hackathons" className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white transition mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to Hackathons
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <Trophy className="h-6 w-6 text-[#CCFF00]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{hackathon.title}</h1>
            <p className="text-sm text-white/40">/{hackathon.slug} &middot; {hackathon.status}</p>
          </div>
        </div>
      </div>

      {/* Rounds Management */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#CCFF00]" /> Round Initialization
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchRounds} className="border-white/10 text-white/60 hover:bg-white/10">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/40 mb-6">
            Initialize rounds to open submissions for participants. Only initialized rounds will accept submissions in the participant dashboard.
          </p>

          {roundsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={`sk-${String(i)}`} className="h-20 w-full" />
              ))}
            </div>
          ) : rounds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
              <Trophy className="mx-auto mb-3 h-10 w-10 text-white/15" />
              <p className="text-sm text-white/40">No rounds created yet</p>
              <p className="text-xs text-white/25 mt-1">Organizers can create rounds from the platform dashboard.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.map((round) => (
                <div
                  key={round.id}
                  className={`flex items-center justify-between rounded-xl border p-5 transition-all ${
                    round.is_initialized
                      ? 'border-[#CCFF00]/20 bg-[#CCFF00]/5'
                      : 'border-white/10 bg-white/2'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                        round.is_initialized
                          ? 'border-[#CCFF00]/30 bg-[#CCFF00]/10'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <span className={`text-sm font-bold ${round.is_initialized ? 'text-[#CCFF00]' : 'text-white/40'}`}>
                        {round.round_number}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{round.name}</p>
                        <Badge className={statusColors[round.status] ?? 'bg-white/10 text-white/60'}>
                          {round.status}
                        </Badge>
                        {round.is_initialized ? (
                          <Badge className="bg-[#CCFF00]/20 text-[#CCFF00]">
                            Initialized
                          </Badge>
                        ) : (
                          <Badge className="bg-white/5 text-white/30">
                            Not Initialized
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-xs text-white/30">
                          Type: {round.type}
                        </p>
                        {round.submission_deadline && (
                          <p className="text-xs text-white/30">
                            Deadline: {new Date(round.submission_deadline).toLocaleDateString()}
                          </p>
                        )}
                        {round.started_at && (
                          <p className="text-xs text-white/30">
                            Started: {new Date(round.started_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => toggleInitialization(round)}
                    disabled={togglingId === round.id}
                    variant={round.is_initialized ? 'outline' : 'default'}
                    className={
                      round.is_initialized
                        ? 'border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300'
                        : 'bg-[#CCFF00] text-black hover:bg-[#b8e600] font-bold'
                    }
                  >
                    {togglingId === round.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                    ) : round.is_initialized ? (
                      <ZapOff className="h-4 w-4 mr-1" />
                    ) : (
                      <Zap className="h-4 w-4 mr-1" />
                    )}
                    {round.is_initialized ? 'Un-initialize' : 'Initialize'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
