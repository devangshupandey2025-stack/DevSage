import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, Trophy, ArrowRight } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  type: string;
  created_at: string;
  member_count?: number;
  hackathon_count?: number;
}

export function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        const res = await apiRequest<{ data: Workspace[] }>('/api/v1/admin/workspaces');
        setWorkspaces(res.data);
      } catch {
        setWorkspaces([]);
      } finally {
        setLoading(false);
      }
    }
    fetchWorkspaces();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Workspaces</h1>
        <p className="mt-1 text-sm text-white/50">All clubs and organizations on the platform</p>
      </div>

      {workspaces.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-white/20" />
            <p className="mt-4 text-white/40">No workspaces yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workspaces.map((ws) => (
            <Link key={ws.id} to={`/workspaces/${ws.id}`}>
              <Card className="border-white/10 bg-white/5 transition hover:border-[#CCFF00]/20">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    <Building2 className="h-6 w-6 text-[#CCFF00]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">{ws.name}</p>
                    <p className="text-xs text-white/40">/{ws.slug}</p>
                  </div>
                  <div className="hidden gap-4 sm:flex">
                    <div className="flex items-center gap-1.5 text-sm text-white/50">
                      <Users className="h-4 w-4" />
                      {ws.member_count ?? 0}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-white/50">
                      <Trophy className="h-4 w-4" />
                      {ws.hackathon_count ?? 0}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-xs text-white/50">
                    {ws.type}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-white/30" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
