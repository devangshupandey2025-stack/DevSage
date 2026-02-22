import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Gavel, ClipboardCheck, CheckCircle2, Clock } from 'lucide-react';

interface JudgeHackathon {
  id: string;
  hackathon_id: string;
  hackathon_title: string;
  hackathon_slug: string;
  hackathon_status: string;
  invite_status: string;
  pending_assignments: number;
  completed_assignments: number;
}

export function ProfilePage() {
  const { user } = useAuth();
  const [hackathons, setHackathons] = useState<JudgeHackathon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest<{ data: JudgeHackathon[] }>('/api/v1/judge/hackathons');
        setHackathons(res.data);
      } catch {
        setHackathons([]);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const total = hackathons.reduce((sum, h) => sum + h.pending_assignments + h.completed_assignments, 0);
    const completed = hackathons.reduce((sum, h) => sum + h.completed_assignments, 0);
    const pending = hackathons.reduce((sum, h) => sum + h.pending_assignments, 0);
    return { total, completed, pending };
  }, [hackathons]);

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400',
    judging: 'bg-violet-500/20 text-violet-400',
    completed: 'bg-sky-500/20 text-sky-400',
    draft: 'bg-white/10 text-white/40',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-black tracking-tight">Profile</h1>

      {/* User Info */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {user?.image ? (
              <img src={user.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#CCFF00] text-xl font-bold text-black">
                {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
            <div>
              <p className="text-xl text-white">{user?.name}</p>
              <Badge variant="outline" className="border-[#CCFF00] text-[#CCFF00] mt-1">
                Judge
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-white/60">
            <Mail className="h-4 w-4" />
            <span>{user?.email}</span>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Statistics */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-lg text-white">Scoring Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                <ClipboardCheck className="mx-auto h-5 w-5 text-[#CCFF00]" />
                <p className="mt-2 text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-white/40">Total</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-400" />
                <p className="mt-2 text-2xl font-bold text-emerald-400">{stats.completed}</p>
                <p className="text-xs text-white/40">Completed</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                <Clock className="mx-auto h-5 w-5 text-amber-400" />
                <p className="mt-2 text-2xl font-bold text-amber-400">{stats.pending}</p>
                <p className="text-xs text-white/40">Pending</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned Hackathons */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-lg text-white">Assigned Hackathons</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : hackathons.length === 0 ? (
            <div className="py-8 text-center">
              <Gavel className="mx-auto h-10 w-10 text-white/20" />
              <p className="mt-3 text-sm text-white/40">No hackathon assignments yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hackathons.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-white">{h.hackathon_title}</p>
                    <div className="mt-1 flex gap-4 text-xs text-white/40">
                      <span>
                        <span className="text-emerald-400 font-medium">{h.completed_assignments}</span> scored
                      </span>
                      <span>
                        <span className="text-amber-400 font-medium">{h.pending_assignments}</span> pending
                      </span>
                    </div>
                  </div>
                  <Badge className={statusColors[h.hackathon_status] ?? 'bg-white/10 text-white/40'}>
                    {h.hackathon_status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
