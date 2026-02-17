import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trophy, ChevronLeft, ChevronRight } from 'lucide-react';

interface Hackathon {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
  starts_at: string | null;
  submission_deadline: string | null;
}

interface PaginatedRes {
  ok: boolean;
  data: Hackathon[];
  meta: { total: number; limit: number; offset: number; has_more: boolean };
}

const statusColors: Record<string, string> = {
  draft: 'bg-white/10 text-white/60',
  active: 'bg-emerald-500/20 text-emerald-400',
  judging: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-sky-500/20 text-sky-400',
  archived: 'bg-white/5 text-white/30',
};

export function HackathonsPage() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiRequest<PaginatedRes>(`/api/v1/admin/hackathons?limit=${limit}&offset=${offset}`);
        setHackathons(res.data);
        setTotal(res.meta.total);
      } catch {
        setHackathons([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [offset]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Hackathons</h1>
        <p className="mt-1 text-sm text-white/50">All hackathons across the platform ({total} total)</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`s-${String(i)}`} className="h-16 w-full" />
          ))}
        </div>
      ) : hackathons.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-white/20" />
            <p className="mt-4 text-white/40">No hackathons yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {hackathons.map((h) => (
            <Card key={h.id} className="border-white/10 bg-white/5">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Trophy className="h-5 w-5 text-[#CCFF00]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{h.title}</p>
                  <p className="text-xs text-white/40">/{h.slug} · Created {new Date(h.created_at).toLocaleDateString()}</p>
                </div>
                {h.starts_at && (
                  <p className="hidden sm:block text-xs text-white/40">
                    Starts {new Date(h.starts_at).toLocaleDateString()}
                  </p>
                )}
                <Badge className={statusColors[h.status] ?? 'bg-white/10 text-white/60'}>
                  {h.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-white/40">Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="border-white/10 text-white/60">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="border-white/10 text-white/60">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
