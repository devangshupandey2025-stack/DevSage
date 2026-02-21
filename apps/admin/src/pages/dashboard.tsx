import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Users, Building2, Trophy, Activity, Database } from 'lucide-react';
import { toast } from 'sonner';

interface PlatformStats {
  total_users: number;
  total_workspaces: number;
  total_hackathons: number;
  active_hackathons: number;
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await apiRequest<{ data: PlatformStats }>('/api/v1/admin/stats');
        setStats(res.data);
      } catch {
        setStats({ total_users: 0, total_workspaces: 0, total_hackathons: 0, active_hackathons: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const metrics = [
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: Users, color: 'text-blue-400' },
    { label: 'Workspaces', value: stats?.total_workspaces ?? 0, icon: Building2, color: 'text-purple-400' },
    { label: 'Hackathons', value: stats?.total_hackathons ?? 0, icon: Trophy, color: 'text-[#CCFF00]' },
    { label: 'Active Now', value: stats?.active_hackathons ?? 0, icon: Activity, color: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="mt-1 text-sm text-white/50">Admin dashboard for the DevSage platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="border-white/10 bg-white/5">
            <CardContent className="flex items-center gap-4 pt-6">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className={`rounded-lg border border-white/10 bg-white/5 p-3 ${metric.color}`}>
                    <metric.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">{metric.value}</p>
                    <p className="text-sm text-white/40">{metric.label}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="/invites"
              className="rounded-lg border border-white/10 bg-white/5 p-4 text-center transition hover:border-[#CCFF00]/20 hover:bg-white/10"
            >
              <p className="font-medium text-white">Manage Invites</p>
              <p className="mt-1 text-xs text-white/40">Invite organizers to the platform</p>
            </a>
            <a
              href="/workspaces"
              className="rounded-lg border border-white/10 bg-white/5 p-4 text-center transition hover:border-[#CCFF00]/20 hover:bg-white/10"
            >
              <p className="font-medium text-white">Workspaces</p>
              <p className="mt-1 text-xs text-white/40">Manage clubs and organizations</p>
            </a>
            <a
              href="/admins"
              className="rounded-lg border border-white/10 bg-white/5 p-4 text-center transition hover:border-[#CCFF00]/20 hover:bg-white/10"
            >
              <p className="font-medium text-white">Admins</p>
              <p className="mt-1 text-xs text-white/40">Manage platform administrators</p>
            </a>
            <a
              href="/users"
              className="rounded-lg border border-white/10 bg-white/5 p-4 text-center transition hover:border-[#CCFF00]/20 hover:bg-white/10"
            >
              <p className="font-medium text-white">Users</p>
              <p className="mt-1 text-xs text-white/40">Browse all platform users</p>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Database className="h-5 w-5 text-[#CCFF00]" /> Maintenance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Audit Hash Backfill</p>
              <p className="text-xs text-white/40 mt-1">Process unhashed audit events to maintain hash chain integrity.</p>
            </div>
            <Button
              onClick={async () => {
                try {
                  const res = await apiRequest<{ data: { processed: number } }>('/api/v1/admin/audit/backfill', { method: 'POST' });
                  toast.success(`Processed ${res.data.processed} audit events`);
                } catch {
                  toast.error('Backfill failed');
                }
              }}
              variant="outline"
              className="border-white/10 text-white hover:bg-white/10"
            >
              Run Backfill
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
