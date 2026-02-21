import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Calendar, Users, Search } from 'lucide-react';

interface Hackathon {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  registration_open: boolean;
}

export function BrowseHackathonsPage() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchHackathons() {
      try {
        const res = await apiRequest<{ data: Hackathon[] }>('/api/v1/hackathons');
        setHackathons(res.data);
      } catch {
        setHackathons([]);
      } finally {
        setLoading(false);
      }
    }
    fetchHackathons();
  }, []);

  const filtered = hackathons.filter(
    (h) =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      (h.tagline && h.tagline.toLowerCase().includes(search.toLowerCase()))
  );

  const statusColors: Record<string, string> = {
    draft: 'bg-white/10 text-white/60',
    active: 'bg-emerald-500/20 text-emerald-400',
    judging: 'bg-purple-500/20 text-purple-400',
    completed: 'bg-sky-500/20 text-sky-400',
    archived: 'bg-white/5 text-white/30',
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold">
            Explore <span className="text-[#CCFF00]">Hackathons</span>
          </h1>
          <p className="mt-3 text-white/50">Discover hackathons happening on DevSage</p>
        </div>

        {/* Search */}
        <div className="relative mx-auto mb-8 max-w-lg">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hackathons..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-white placeholder:text-white/30 focus:border-[#CCFF00]/40 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Trophy className="mx-auto h-12 w-12 text-white/20" />
            <p className="mt-4 text-white/40">
              {search ? 'No hackathons match your search' : 'No hackathons available'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((h) => (
              <Card key={h.id} className="h-full border-white/10 bg-white/5">
                <CardContent className="flex h-full flex-col justify-between pt-6">
                  <div>
                    <div className="flex items-start justify-between">
                      <h2 className="text-lg font-semibold text-white">{h.name}</h2>
                      <Badge className={statusColors[h.status] ?? 'bg-white/10 text-white/60'}>
                        {h.status}
                      </Badge>
                    </div>
                    {h.tagline && (
                      <p className="mt-2 text-sm text-white/50">{h.tagline}</p>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-white/40">
                    {h.starts_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(h.starts_at).toLocaleDateString()}
                      </span>
                    )}
                    {h.registration_open && (
                      <Badge className="bg-[#CCFF00]/10 text-[#CCFF00] text-xs">
                        Registration Open
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
