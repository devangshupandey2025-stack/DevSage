import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gavel, ClipboardCheck, ArrowRight, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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

export function DashboardPage() {
  const { user } = useAuth();
  const [hackathons, setHackathons] = useState<JudgeHackathon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest<{ data: JudgeHackathon[] }>('/api/v1/judge/hackathons');
        setHackathons(res.data);
      } catch {
        // If the API endpoint doesn't exist yet, fall back gracefully
        setHackathons([]);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400',
    judging: 'bg-violet-500/20 text-violet-400',
    completed: 'bg-sky-500/20 text-sky-400',
    draft: 'bg-white/10 text-white/40',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-black tracking-tight"
        >
          Welcome back, <span className="text-[#CCFF00]">{user?.name?.split(' ')[0] ?? 'Judge'}</span>
        </motion.h1>
        <p className="mt-2 text-white/40">
          Here are your judging assignments across all hackathons.
        </p>
      </div>

      {/* Hackathon Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : hackathons.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-16 text-center">
            <Gavel className="mx-auto h-12 w-12 text-white/20" />
            <p className="mt-4 text-lg font-semibold text-white/60">No judging assignments yet</p>
            <p className="mt-2 text-sm text-white/30">
              You'll see hackathons here once you accept a judge invitation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {hackathons.map((h) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-white/10 bg-white/5 transition hover:border-[#CCFF00]/20">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg text-white">{h.hackathon_title}</CardTitle>
                    <Badge className={statusColors[h.hackathon_status] ?? 'bg-white/10 text-white/40'}>
                      {h.hackathon_status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-white/40">Pending</span>
                      <p className="text-xl font-bold text-amber-400">{h.pending_assignments}</p>
                    </div>
                    <div>
                      <span className="text-white/40">Scored</span>
                      <p className="text-xl font-bold text-emerald-400">{h.completed_assignments}</p>
                    </div>
                  </div>
                  <Link to={`/hackathons/${h.hackathon_slug}/score`}>
                    <Button className="w-full bg-[#CCFF00] text-black hover:bg-[#CCFF00]/80">
                      Start Scoring <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
