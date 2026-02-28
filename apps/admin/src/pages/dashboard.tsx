import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Users, Building2, Trophy, Activity, Database, FileText, TrendingUp, ArrowRight, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface PlatformStats {
  total_users: number;
  total_workspaces: number;
  total_hackathons: number;
  active_hackathons: number;
}

interface RequestStats {
  submitted: number;
  under_review: number;
  approved: number;
  building: number;
  ready: number;
  rejected: number;
  changes_requested: number;
  total: number;
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [requestStats, setRequestStats] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [platformRes, reqRes] = await Promise.all([
          apiRequest<{ data: PlatformStats }>('/api/v1/admin/stats'),
          apiRequest<{ data: RequestStats }>('/api/v1/hackathon-requests/admin/stats').catch(() => ({ data: { submitted: 0, under_review: 0, approved: 0, building: 0, ready: 0, rejected: 0, changes_requested: 0, total: 0 } })),
        ]);
        setStats(platformRes.data);
        setRequestStats(reqRes.data);
      } catch {
        setStats({ total_users: 0, total_workspaces: 0, total_hackathons: 0, active_hackathons: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const metrics = [
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Workspaces', value: stats?.total_workspaces ?? 0, icon: Building2, color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20' },
    { label: 'Hackathons', value: stats?.total_hackathons ?? 0, icon: Trophy, color: 'text-[#CCFF00]', bgColor: 'bg-[#CCFF00]/10 border-[#CCFF00]/20' },
    { label: 'Active Now', value: stats?.active_hackathons ?? 0, icon: Activity, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
  ];

  const pendingRequests = (requestStats?.submitted ?? 0) + (requestStats?.under_review ?? 0);

  const pipeline = [
    { label: 'Submitted', value: requestStats?.submitted ?? 0, color: 'bg-blue-400' },
    { label: 'Reviewing', value: requestStats?.under_review ?? 0, color: 'bg-amber-400' },
    { label: 'Approved', value: requestStats?.approved ?? 0, color: 'bg-emerald-400' },
    { label: 'Building', value: requestStats?.building ?? 0, color: 'bg-purple-400' },
    { label: 'Ready', value: requestStats?.ready ?? 0, color: 'bg-[#CCFF00]' },
    { label: 'Changes', value: requestStats?.changes_requested ?? 0, color: 'bg-orange-400' },
    { label: 'Rejected', value: requestStats?.rejected ?? 0, color: 'bg-red-400' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Platform Overview</h1>
          <p className="mt-1 text-sm text-white/40">DevSage admin dashboard</p>
        </div>
        {pendingRequests > 0 && (
          <a
            href="/hackathon-requests"
            className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs font-bold text-amber-400 transition hover:bg-amber-500/10"
          >
            <Zap className="h-3.5 w-3.5" />
            {pendingRequests} pending request{pendingRequests !== 1 ? 's' : ''}
            <ArrowRight className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="border-white/6 bg-white/3 hover:bg-white/5 transition-colors">
            <CardContent className="pt-6">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-4xl font-black tabular-nums text-white">{metric.value.toLocaleString()}</p>
                    <p className="text-xs font-medium text-white/40 mt-1">{metric.label}</p>
                  </div>
                  <div className={`rounded-xl border p-2.5 ${metric.bgColor}`}>
                    <metric.icon className={`h-5 w-5 ${metric.color}`} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Request Pipeline */}
      <Card className="border-white/6 bg-white/3">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-[#CCFF00]" />
            Hackathon Request Pipeline
            <span className="ml-auto text-xs font-normal text-white/30">{requestStats?.total ?? 0} total</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              {/* Pipeline bar */}
              <div className="flex h-3 rounded-full overflow-hidden bg-white/5 mb-4">
                {pipeline.filter((s) => s.value > 0).map((s) => (
                  <div
                    key={s.label}
                    className={`${s.color} transition-all duration-500`}
                    style={{ width: `${((requestStats?.total ?? 1) > 0 ? s.value / (requestStats?.total ?? 1) : 0) * 100}%` }}
                    title={`${s.label}: ${s.value}`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {pipeline.map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className={`h-2 w-2 rounded-full ${s.color}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{s.label}</span>
                    </div>
                    <p className="text-lg font-bold text-white tabular-nums">{s.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions + Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-white/6 bg-white/3">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/invites', label: 'Manage Invites', sub: 'Invite organizers' },
                { href: '/workspaces', label: 'Workspaces', sub: 'Manage clubs & orgs' },
                { href: '/admins', label: 'Admins', sub: 'Platform administrators' },
                { href: '/users', label: 'Users', sub: 'Browse all users' },
                { href: '/hackathons', label: 'Hackathons', sub: 'All hackathons' },
                { href: '/hackathon-requests', label: 'Requests', sub: pendingRequests > 0 ? `${pendingRequests} pending` : 'Review requests' },
              ].map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className="group rounded-xl border border-white/6 bg-white/2 p-4 transition hover:border-[#CCFF00]/20 hover:bg-white/5"
                >
                  <p className="font-medium text-white text-sm group-hover:text-[#CCFF00] transition-colors">{action.label}</p>
                  <p className="mt-0.5 text-[11px] text-white/30">{action.sub}</p>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/6 bg-white/3">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-[#CCFF00]" /> Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-xl border border-white/6 bg-white/2 p-4">
              <div>
                <p className="font-medium text-white text-sm">Audit Hash Backfill</p>
                <p className="text-[11px] text-white/30 mt-0.5">Process unhashed audit events for hash chain integrity</p>
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
                size="sm"
                variant="outline"
                className="border-white/10 text-white/60 hover:bg-white/10 shrink-0"
              >
                Run Backfill
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
