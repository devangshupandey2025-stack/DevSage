import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Trophy,
  Users,
  FileCode,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Zap,
  Star,
  BarChart3,
  X,
  Building,
  Send,
  Check,
  Eye,
  Hammer,
  Package,
  XCircle,
  Clock,
} from 'lucide-react';

type HackathonStatus = 'draft' | 'active' | 'judging' | 'completed' | 'archived';

interface Hackathon {
  id: string;
  workspace_id: string;
  slug: string;
  title: string;
  description: string | null;
  status: HackathonStatus;
  starts_at: string | null;
  judging_starts: string | null;
  judging_ends: string | null;
  max_team_size: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Workspace {
  id: string;
  slug: string;
  name: string;
}

interface HackathonListResponse {
  ok: boolean;
  data: Hackathon[];
  meta: { total: number; limit: number; offset: number };
}

type RequestStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'changes_requested' | 'building' | 'ready';

interface HackathonRequest {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  num_events: number | null;
  expected_participants: number | null;
  team_min_size: number | null;
  team_max_size: number | null;
  additional_details: string | null;
  status: RequestStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const REQUEST_STAGES: { key: RequestStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'submitted', label: 'Submitted', icon: Send },
  { key: 'under_review', label: 'Under Review', icon: Eye },
  { key: 'approved', label: 'Approved', icon: Check },
  { key: 'building', label: 'Building', icon: Hammer },
  { key: 'ready', label: 'Ready', icon: Package },
];

const NEXT_STATUS: Record<string, string> = {
  draft: 'active',
  active: 'judging',
  judging: 'completed',
  completed: 'archived',
};

const NEXT_PHASE_LABEL: Record<string, string> = {
  draft: 'Activate',
  active: 'Start Judging',
  judging: 'Complete',
  completed: 'Archive',
};

const STATUS_ORDER: HackathonStatus[] = ['draft', 'active', 'judging', 'completed', 'archived'];

function StatusBadge({
  status,
  size = 'md',
  pulse = false,
}: {
  status: HackathonStatus;
  size?: 'sm' | 'md';
  pulse?: boolean;
}) {
  const cfg: Record<HackathonStatus, { label: string; cls: string }> = {
    draft:     { label: 'Draft',     cls: 'bg-white/10 text-white/50' },
    active:    { label: 'Active',    cls: 'bg-[#CCFF00] text-black' },
    judging:   { label: 'Judging',   cls: 'bg-violet-500 text-white' },
    completed: { label: 'Completed', cls: 'bg-emerald-500 text-white' },
    archived:  { label: 'Archived',  cls: 'bg-white/8 text-white/30' },
  };
  const { label, cls } = cfg[status];
  const sz = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';
  return (
    <span className={`inline-flex items-center rounded-full font-bold ${sz} ${cls} ${pulse ? 'animate-pulse' : ''}`}>
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  change,
  changePositive,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  change?: string;
  changePositive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/60">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5">
          <Icon className="h-6 w-6 text-[#CCFF00]" />
        </div>
      </div>
      {change && (
        <div className={`mt-3 text-xs font-medium ${changePositive ? 'text-green-400' : 'text-red-400'}`}>
          {change}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
        <Icon className="h-8 w-8 text-white/30" />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-white/40">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startsAt: '',
    judgingStarts: '',
    maxTeamSize: '4',
  });
  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [creatingWs, setCreatingWs] = useState(false);
  const [wsFormData, setWsFormData] = useState({
    name: '',
    slug: '',
    type: 'organization' as 'club' | 'organization' | 'individual',
  });
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestFormData, setRequestFormData] = useState({
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    numEvents: '1',
    expectedParticipants: '',
    teamMinSize: '',
    teamMaxSize: '',
    additionalDetails: '',
  });
  const [myRequests, setMyRequests] = useState<HackathonRequest[]>([]);
  const [fetchingRequests, setFetchingRequests] = useState(true);

  useEffect(() => {
    fetchHackathons();
    fetchWorkspaces();
    fetchRequests();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await apiRequest<{ ok: boolean; data: Workspace[] }>('/api/v1/workspaces');
      setWorkspaces(response.data);
    } catch (_error) {
      // Workspaces may not be accessible for all users
    }
  };

  const createWorkspace = async () => {
    if (!wsFormData.name || !wsFormData.slug) {
      toast.error('Please fill in all required fields');
      return;
    }
    setCreatingWs(true);
    try {
      await apiRequest('/api/v1/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          name: wsFormData.name,
          slug: wsFormData.slug,
          type: wsFormData.type,
        }),
      });
      toast.success('Workspace created!');
      setWsDialogOpen(false);
      setWsFormData({ name: '', slug: '', type: 'organization' });
      fetchWorkspaces();
    } catch (_error) {
      toast.error('Failed to create workspace');
    } finally {
      setCreatingWs(false);
    }
  };

  const fetchRequests = async () => {
    setFetchingRequests(true);
    try {
      const response = await apiRequest<{ ok: boolean; data: HackathonRequest[] }>('/api/v1/hackathon-requests');
      setMyRequests(response.data);
    } catch (_error) {
      // Requests endpoint may not be available
    } finally {
      setFetchingRequests(false);
    }
  };

  const submitRequest = async () => {
    if (!requestFormData.title) {
      toast.error('Please provide a title');
      return;
    }
    if (workspaces.length === 0) {
      toast.error('No workspace available. Create one first.');
      setWsDialogOpen(true);
      return;
    }
    setSubmittingRequest(true);
    try {
      await apiRequest('/api/v1/hackathon-requests', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaces[0].id,
          title: requestFormData.title,
          description: requestFormData.description || undefined,
          starts_at: requestFormData.startsAt ? new Date(requestFormData.startsAt).toISOString() : undefined,
          ends_at: requestFormData.endsAt ? new Date(requestFormData.endsAt).toISOString() : undefined,
          num_events: parseInt(requestFormData.numEvents, 10) || undefined,
          expected_participants: parseInt(requestFormData.expectedParticipants, 10) || undefined,
          team_min_size: parseInt(requestFormData.teamMinSize, 10) || undefined,
          team_max_size: parseInt(requestFormData.teamMaxSize, 10) || undefined,
          additional_details: requestFormData.additionalDetails || undefined,
        }),
      });
      toast.success('Hackathon request submitted!');
      setRequestDialogOpen(false);
      setRequestFormData({ title: '', description: '', startsAt: '', endsAt: '', numEvents: '1', expectedParticipants: '', teamMinSize: '', teamMaxSize: '', additionalDetails: '' });
      fetchRequests();
    } catch (_error) {
      toast.error('Failed to submit request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const fetchHackathons = async () => {
    try {
      const response = await apiRequest<HackathonListResponse>('/api/v1/hackathons');
      if (user) {
        const myHackathons = response.data.filter((h) => h.created_by === user.id);
        setHackathons(myHackathons);
      } else {
        setHackathons([]);
      }
    } catch (_error) {
      toast.error('Failed to load hackathons');
    } finally {
      setLoading(false);
    }
  };

  const createHackathon = async () => {
    if (!formData.title || !formData.startsAt || !formData.judgingStarts) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (workspaces.length === 0) {
      toast.error('No workspace available. Create one first.');
      setWsDialogOpen(true);
      return;
    }
    const slug = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setCreating(true);
    try {
      await apiRequest('/api/v1/hackathons', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: workspaces[0].id,
          slug,
          title: formData.title,
          description: formData.description,
          startsAt: new Date(formData.startsAt).toISOString(),
          judgingStarts: new Date(formData.judgingStarts).toISOString(),
          maxTeamSize: parseInt(formData.maxTeamSize, 10),
        }),
      });
      toast.success('Hackathon created!');
      setCreateDialogOpen(false);
      setFormData({ title: '', description: '', startsAt: '', judgingStarts: '', maxTeamSize: '4' });
      fetchHackathons();
    } catch (_error) {
      toast.error('Failed to create hackathon');
    } finally {
      setCreating(false);
    }
  };

  const advancePhase = async (slug: string, currentStatus: string) => {
    const nextStatus = NEXT_STATUS[currentStatus];
    if (!nextStatus) return;
    try {
      await apiRequest(`/api/v1/hackathons/${slug}/transition`, {
        method: 'POST',
        body: JSON.stringify({ target_status: nextStatus, version: -1 }),
      });
      toast.success(`Phase advanced to ${nextStatus.replace(/_/g, ' ')}`);
      fetchHackathons();
    } catch (_error) {
      toast.error('Failed to advance phase');
    }
  };

  const byStatus = (s: HackathonStatus) => hackathons.filter((h) => h.status === s).length;
  const activeCount = byStatus('active') + byStatus('judging');
  const progressPct = Math.min(
    100,
    Math.round(((byStatus('completed') + byStatus('archived')) / Math.max(1, hackathons.length)) * 100),
  );

  const sortedHackathons = [...hackathons].sort((a, b) => {
    const byS = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (byS !== 0) return byS;
    const aT = a.judging_starts ? new Date(a.judging_starts).getTime() : Number.POSITIVE_INFINITY;
    const bT = b.judging_starts ? new Date(b.judging_starts).getTime() : Number.POSITIVE_INFINITY;
    return aT - bT;
  });

  const selected = hackathons.find((h) => h.id === selectedId) ?? null;

  return (
    <div className="min-h-screen text-white">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-black via-neutral-950 to-neutral-900" />
      <div className="fixed inset-0 -z-10 opacity-[0.65] [background:radial-gradient(80%_60%_at_30%_20%,rgba(204,255,0,0.12),transparent_60%),radial-gradient(60%_45%_at_80%_30%,rgba(139,92,246,0.10),transparent_55%),radial-gradient(65%_50%_at_40%_85%,rgba(255,255,255,0.05),transparent_60%)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] [background-size:56px_56px]" />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm mb-8">
          <div className="absolute inset-0 opacity-100 [background:radial-gradient(1200px_500px_at_10%_0%,rgba(204,255,0,0.16),transparent_55%),radial-gradient(900px_500px_at_85%_20%,rgba(139,92,246,0.14),transparent_55%)]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:44px_44px]" />

          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#CCFF00] shadow-[0_0_0_4px_rgba(204,255,0,0.12)]" />
                  Organizer Console
                </div>
                <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
                  Welcome back,{' '}
                  <span className="text-[#CCFF00]">{user?.name?.split(' ')[0] ?? 'Organizer'}</span>
                </h1>
                <p className="mt-2 text-white/60 max-w-2xl">
                  Manage your hackathons, track teams, and monitor progress with real-time clarity.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 min-w-[260px]">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/35">Season progress</p>
                    <p className="text-xs font-semibold text-white/50">{progressPct}%</p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-[#CCFF00] shadow-[0_0_24px_rgba(204,255,0,0.28)] transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/35">
                    <span>{byStatus('completed') + byStatus('archived')} shipped</span>
                    <span>{byStatus('active') + byStatus('judging')} in flight</span>
                  </div>
                </div>

                <button
                  onClick={() => setWsDialogOpen(true)}
                  className="group flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 transition group-hover:bg-white/10">
                    <Building className="h-4 w-4" />
                  </span>
                  New Workspace
                </button>

                <button
                  onClick={() => setCreateDialogOpen(true)}
                  className="group flex items-center justify-center gap-2 rounded-2xl bg-[#CCFF00] px-5 py-3 text-sm font-black text-black transition hover:bg-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/10 transition group-hover:bg-black/15">
                    <Plus className="h-4 w-4" />
                  </span>
                  New Hackathon
                </button>

                <button
                  onClick={() => setRequestDialogOpen(true)}
                  className="group flex items-center justify-center gap-2 rounded-2xl border border-[#CCFF00]/30 bg-[#CCFF00]/10 px-5 py-3 text-sm font-bold text-[#CCFF00] transition hover:border-[#CCFF00]/50 hover:bg-[#CCFF00]/20"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#CCFF00]/10 transition group-hover:bg-[#CCFF00]/20">
                    <Send className="h-4 w-4" />
                  </span>
                  Request Hackathon
                </button>
              </div>
            </div>

            {/* Status rail */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-2">
              {STATUS_ORDER.map((s) => {
                const count = byStatus(s);
                const accent =
                  s === 'active'
                    ? 'from-[#CCFF00]/25 to-transparent'
                    : s === 'judging'
                      ? 'from-violet-500/25 to-transparent'
                      : s === 'completed'
                        ? 'from-emerald-500/25 to-transparent'
                        : 'from-white/10 to-transparent';
                return (
                  <div key={s} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                    <div className={`h-0.5 w-full rounded-full bg-gradient-to-r ${accent}`} />
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/40">{s}</p>
                      <p className="text-sm font-black text-white">{count}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Hackathons" value={hackathons.length} icon={Trophy} />
          <MetricCard label="Active Now" value={activeCount} icon={Zap} change={activeCount > 0 ? 'Live' : undefined} changePositive />
          <MetricCard label="Teams" value={hackathons.length * 8} icon={Users} change="+12%" changePositive />
          <MetricCard label="Submissions" value={hackathons.filter((h) => h.status !== 'draft').length * 12} icon={FileCode} />
        </div>

        {/* Hackathon section header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white/90">Your Hackathons</h2>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-[#CCFF00]/40" />
            <span className="text-sm text-white/40">{hackathons.length} total</span>
          </div>
        </div>

        {/* Hackathon grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`skel-${String(i)}`} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <Skeleton className="mb-4 h-5 w-20 rounded-full bg-white/10" />
                <Skeleton className="mb-3 h-6 w-3/4 rounded-lg bg-white/10" />
                <Skeleton className="mb-2 h-4 w-full rounded bg-white/10" />
                <Skeleton className="mb-2 h-4 w-5/6 rounded bg-white/10" />
                <Skeleton className="mt-5 h-10 w-full rounded-xl bg-white/10" />
              </div>
            ))}
          </div>
        ) : hackathons.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No hackathons yet"
            description="Create your first hackathon and start building something amazing with your community."
            action={
              <button
                onClick={() => setCreateDialogOpen(true)}
                className="flex items-center gap-2 rounded-full bg-[#CCFF00] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-white"
              >
                <Plus className="h-4 w-4" /> Create Your First Hackathon
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sortedHackathons.map((hackathon) => (
              <div
                key={hackathon.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 transition-all duration-300 ${
                    hackathon.status === 'active'
                      ? 'bg-[#CCFF00]'
                      : hackathon.status === 'judging'
                        ? 'bg-violet-500'
                        : 'bg-white/10'
                  }`}
                />
                <div className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <StatusBadge status={hackathon.status} size="sm" pulse={hackathon.status === 'active'} />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(hackathon.id)}
                        className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-white/55 transition hover:bg-white/10 hover:text-white"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => navigate(`/hackathons/${hackathon.slug}`)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/30 transition hover:bg-[#CCFF00]/15 hover:text-[#CCFF00]"
                        aria-label="Open"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <Link to={`/hackathons/${hackathon.slug}`}>
                    <h3 className="mb-2 text-lg font-bold text-white transition-colors duration-300 group-hover:text-[#CCFF00]">
                      {hackathon.title}
                    </h3>
                  </Link>

                  <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-white/50">
                    {hackathon.description || 'No description provided'}
                  </p>

                  <div className="mb-5 flex items-center gap-4 text-xs text-white/40">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Max {hackathon.max_team_size}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {hackathon.judging_starts
                        ? new Date(hackathon.judging_starts).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'No deadline'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 border-t border-white/10 pt-4">
                    <Link
                      to={`/hackathons/${hackathon.slug}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
                    >
                      <BarChart3 className="h-4 w-4" /> Manage
                    </Link>
                    {NEXT_PHASE_LABEL[hackathon.status] && (
                      <button
                        type="button"
                        onClick={() => advancePhase(hackathon.slug, hackathon.status)}
                        className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00]/10 px-4 py-2.5 text-sm font-semibold text-[#CCFF00] transition hover:bg-[#CCFF00]/20"
                      >
                        {NEXT_PHASE_LABEL[hackathon.status]}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick tip */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Zap className="h-4 w-4 text-[#CCFF00]/50" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">Quick Tip</span>
          </div>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-white/40">
            Click on any hackathon card to access the full management dashboard with teams, submissions, judging, rounds, and analytics views.
          </p>
        </div>

        {/* My Requests tracker */}
        <div className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#CCFF00]/10">
                <Send className="h-5 w-5 text-[#CCFF00]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white/90">My Requests</h2>
                <p className="text-xs text-white/40">Track the status of your hackathon requests</p>
              </div>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/40">
              {myRequests.length} request{myRequests.length !== 1 ? 's' : ''}
            </span>
          </div>

          {fetchingRequests ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={`req-skel-${String(i)}`} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <Skeleton className="mb-4 h-5 w-1/3 rounded-lg bg-white/10" />
                  <Skeleton className="mb-3 h-4 w-full rounded bg-white/10" />
                  <Skeleton className="h-12 w-full rounded-xl bg-white/10" />
                </div>
              ))}
            </div>
          ) : myRequests.length === 0 ? (
            <EmptyState
              icon={Send}
              title="No requests yet"
              description="Submit a hackathon request and track its progress here — from submission to launch."
              action={
                <button
                  onClick={() => setRequestDialogOpen(true)}
                  className="flex items-center gap-2 rounded-full border border-[#CCFF00]/30 bg-[#CCFF00]/10 px-6 py-2.5 text-sm font-bold text-[#CCFF00] transition hover:bg-[#CCFF00]/20"
                >
                  <Send className="h-4 w-4" /> Submit a Request
                </button>
              }
            />
          ) : (
            <div className="space-y-4">
              {myRequests.map((req) => {
                const isRejected = req.status === 'rejected';
                const isChangesRequested = req.status === 'changes_requested';
                const currentIdx = (isRejected || isChangesRequested) ? -1 : REQUEST_STAGES.findIndex((s) => s.key === req.status);

                return (
                  <div
                    key={req.id}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/[0.07]"
                  >
                    {/* Top accent bar */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 transition-all duration-300 ${
                        isRejected
                          ? 'bg-red-500'
                          : req.status === 'ready'
                            ? 'bg-emerald-500'
                            : 'bg-[#CCFF00]'
                      }`}
                    />

                    <div className="p-6">
                      {/* Header row */}
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-white">{req.title}</h3>
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold text-red-400">
                                <XCircle className="h-3 w-3" /> Rejected
                              </span>
                            )}
                            {req.status === 'ready' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                                <Check className="h-3 w-3" /> Ready
                              </span>
                            )}
                            {req.status === 'changes_requested' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[11px] font-bold text-orange-400">
                                <Clock className="h-3 w-3" /> Changes Requested
                              </span>
                            )}
                          </div>
                          {req.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-white/45">{req.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/35">
                          {req.starts_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(req.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {req.ends_at && (
                            <span className="flex items-center gap-1">
                              → {new Date(req.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tracker stepper */}
                      {!isRejected && !isChangesRequested ? (
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                          <div className="flex items-center">
                            {REQUEST_STAGES.map((stage, idx) => {
                              const isCompleted = idx < currentIdx;
                              const isCurrent = idx === currentIdx;
                              const isFuture = idx > currentIdx;
                              const StageIcon = stage.icon;

                              return (
                                <div key={stage.key} className="flex flex-1 items-center">
                                  <div className="flex flex-col items-center gap-2">
                                    {/* Circle */}
                                    <div
                                      className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                                        isCompleted
                                          ? 'border-[#CCFF00] bg-[#CCFF00] shadow-[0_0_16px_rgba(204,255,0,0.3)]'
                                          : isCurrent
                                            ? 'border-[#CCFF00] bg-[#CCFF00]/20 shadow-[0_0_20px_rgba(204,255,0,0.25)]'
                                            : 'border-white/15 bg-white/5'
                                      }`}
                                    >
                                      {isCompleted ? (
                                        <Check className="h-4 w-4 text-black" />
                                      ) : (
                                        <StageIcon className={`h-4 w-4 ${isCurrent ? 'text-[#CCFF00]' : 'text-white/25'}`} />
                                      )}
                                      {isCurrent && (
                                        <span className="absolute inset-0 animate-ping rounded-full border-2 border-[#CCFF00] opacity-20" />
                                      )}
                                    </div>
                                    {/* Label */}
                                    <span
                                      className={`text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${
                                        isCompleted
                                          ? 'text-[#CCFF00]/70'
                                          : isCurrent
                                            ? 'text-[#CCFF00] font-bold'
                                            : 'text-white/25'
                                      }`}
                                    >
                                      {stage.label}
                                    </span>
                                  </div>
                                  {/* Connector line */}
                                  {idx < REQUEST_STAGES.length - 1 && (
                                    <div className="mx-1 mb-5 h-0.5 flex-1">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          idx < currentIdx ? 'bg-[#CCFF00]/60' : 'bg-white/10'
                                        }`}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : isChangesRequested ? (
                        <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-orange-500/40 bg-orange-500/15">
                              <Clock className="h-4 w-4 text-orange-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-orange-400">Changes requested by admin</p>
                              {req.admin_notes && (
                                <p className="mt-0.5 text-xs text-orange-400/60">{req.admin_notes}</p>
                              )}
                              <p className="mt-1 text-xs text-white/40">Edit and resubmit your request to continue.</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-red-500/40 bg-red-500/15">
                              <XCircle className="h-4 w-4 text-red-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-red-400">Request was not approved</p>
                              {req.admin_notes && (
                                <p className="mt-0.5 text-xs text-red-400/60">{req.admin_notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Footer: metadata & admin notes */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[11px] text-white/30">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {req.num_events && (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                              {req.num_events} event{req.num_events !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {!isRejected && req.admin_notes && (
                          <div className="max-w-xs rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                            <p className="text-[11px] text-white/50">
                              <span className="font-semibold text-white/60">Admin: </span>
                              {req.admin_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Details drawer */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedId(null)}
          />
          <div className="absolute right-0 top-0 h-full w-full overflow-y-auto border-l border-white/10 bg-black/80 backdrop-blur-xl sm:w-[520px]">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selected.status} size="sm" pulse={selected.status === 'active'} />
                    <span className="text-xs text-white/35">{selected.slug}</span>
                  </div>
                  <h3 className="mt-3 text-2xl font-black tracking-tight text-white">{selected.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">
                    {selected.description || 'No description provided.'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">Max team size</p>
                  <p className="mt-2 text-lg font-black text-white">{selected.max_team_size}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">Judging Starts</p>
                  <p className="mt-2 text-sm font-bold text-white">
                    {selected.judging_starts
                      ? new Date(selected.judging_starts).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Not set'}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/4 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">Phase</p>
                  <p className="text-xs font-semibold text-white/45">
                    Next: {NEXT_STATUS[selected.status] ?? '—'}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    to={`/hackathons/${selected.slug}`}
                    className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-center text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    Open Manager
                  </Link>
                  {NEXT_PHASE_LABEL[selected.status] && (
                    <button
                      type="button"
                      onClick={() => {
                        advancePhase(selected.slug, selected.status);
                        setSelectedId(null);
                      }}
                      className="rounded-xl bg-[#CCFF00]/12 px-4 py-2.5 text-sm font-black text-[#CCFF00] transition hover:bg-[#CCFF00]/20"
                    >
                      {NEXT_PHASE_LABEL[selected.status]}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">Insight</p>
                <p className="mt-2 text-sm text-white/45">
                  Keep momentum: publish updates during{' '}
                  <span className="font-semibold text-white/70">Active</span> and lock criteria before{' '}
                  <span className="font-semibold text-white/70">Judging</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create dialog */}
      {createDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="absolute inset-0" onClick={() => setCreateDialogOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/20 bg-black/90 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_120px_rgba(0,0,0,0.85)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Create Hackathon</h3>
                <p className="mt-1 text-sm text-white/40">Set up a new hackathon. You can customize everything later.</p>
              </div>
              <button
                onClick={() => setCreateDialogOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {workspaces.length === 0 && (
              <div className="mb-5 rounded-xl border border-[#CCFF00]/20 bg-[#CCFF00]/5 p-4">
                <p className="text-sm text-white/60">
                  You need a workspace before creating a hackathon.{' '}
                  <button
                    type="button"
                    onClick={() => { setCreateDialogOpen(false); setWsDialogOpen(true); }}
                    className="font-semibold text-[#CCFF00] underline underline-offset-2 transition hover:text-white"
                  >
                    Create a workspace first
                  </button>
                </p>
              </div>
            )}

            <div className="mb-6 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Title *
                </label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. AI Frontier Hackathon 2026"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Description
                </label>
                <input
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="A brief description of your hackathon"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                    Starts At *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => setFormData((f) => ({ ...f, startsAt: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                    Judging Starts *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.judgingStarts}
                    onChange={(e) => setFormData((f) => ({ ...f, judgingStarts: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Max Team Size
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.maxTeamSize}
                  onChange={(e) => setFormData((f) => ({ ...f, maxTeamSize: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCreateDialogOpen(false)}
                className="rounded-lg border border-white/10 bg-transparent px-5 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={createHackathon}
                disabled={creating}
                className="rounded-lg bg-[#CCFF00] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create workspace dialog */}
      {wsDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="absolute inset-0" onClick={() => setWsDialogOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/20 bg-black/90 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_120px_rgba(0,0,0,0.85)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Create Workspace</h3>
                <p className="mt-1 text-sm text-white/40">Set up a workspace to organize your hackathons.</p>
              </div>
              <button
                onClick={() => setWsDialogOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Name *
                </label>
                <input
                  value={wsFormData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    setWsFormData((f) => ({ ...f, name, slug }));
                  }}
                  placeholder="e.g. Acme Engineering"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Slug *
                </label>
                <input
                  value={wsFormData.slug}
                  onChange={(e) => setWsFormData((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="acme-engineering"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                />
                <p className="mt-1.5 text-xs text-white/30">URL-friendly identifier, auto-generated from name</p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Type *
                </label>
                <select
                  value={wsFormData.type}
                  onChange={(e) => setWsFormData((f) => ({ ...f, type: e.target.value as 'club' | 'organization' | 'individual' }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                >
                  <option value="organization" className="bg-black text-white">Organization</option>
                  <option value="club" className="bg-black text-white">Club</option>
                  <option value="individual" className="bg-black text-white">Individual</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setWsDialogOpen(false)}
                className="rounded-lg border border-white/10 bg-transparent px-5 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={createWorkspace}
                disabled={creatingWs}
                className="rounded-lg bg-[#CCFF00] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white disabled:opacity-50"
              >
                {creatingWs ? 'Creating…' : 'Create Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request hackathon dialog */}
      {requestDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="absolute inset-0" onClick={() => setRequestDialogOpen(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/20 bg-black/90 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_120px_rgba(0,0,0,0.85)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Request New Hackathon</h3>
                <p className="mt-1 text-sm text-white/40">Submit a request and we'll get it set up for you.</p>
              </div>
              <button
                onClick={() => setRequestDialogOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {workspaces.length === 0 && (
              <div className="mb-5 rounded-xl border border-[#CCFF00]/20 bg-[#CCFF00]/5 p-4">
                <p className="text-sm text-white/60">
                  You need a workspace before submitting a request.{' '}
                  <button
                    type="button"
                    onClick={() => { setRequestDialogOpen(false); setWsDialogOpen(true); }}
                    className="font-semibold text-[#CCFF00] underline underline-offset-2 transition hover:text-white"
                  >
                    Create a workspace first
                  </button>
                </p>
              </div>
            )}

            <div className="mb-6 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Title *
                </label>
                <input
                  value={requestFormData.title}
                  onChange={(e) => setRequestFormData((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Spring 2026 Innovation Hackathon"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Description
                </label>
                <textarea
                  value={requestFormData.description}
                  onChange={(e) => setRequestFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the hackathon theme, goals, and target audience…"
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                    Starts At
                  </label>
                  <input
                    type="datetime-local"
                    value={requestFormData.startsAt}
                    onChange={(e) => setRequestFormData((f) => ({ ...f, startsAt: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                    Ends At
                  </label>
                  <input
                    type="datetime-local"
                    value={requestFormData.endsAt}
                    onChange={(e) => setRequestFormData((f) => ({ ...f, endsAt: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Number of Events
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={requestFormData.numEvents}
                  onChange={(e) => setRequestFormData((f) => ({ ...f, numEvents: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Expected Participants
                </label>
                <input
                  type="number"
                  min={1}
                  value={requestFormData.expectedParticipants}
                  onChange={(e) => setRequestFormData((f) => ({ ...f, expectedParticipants: e.target.value }))}
                  placeholder="e.g. 200"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                    Team Min Size
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={requestFormData.teamMinSize}
                    onChange={(e) => setRequestFormData((f) => ({ ...f, teamMinSize: e.target.value }))}
                    placeholder="e.g. 2"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                    Team Max Size
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={requestFormData.teamMaxSize}
                    onChange={(e) => setRequestFormData((f) => ({ ...f, teamMaxSize: e.target.value }))}
                    placeholder="e.g. 5"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                  Additional Details
                </label>
                <textarea
                  value={requestFormData.additionalDetails}
                  onChange={(e) => setRequestFormData((f) => ({ ...f, additionalDetails: e.target.value }))}
                  placeholder="Any extra info — special requirements, sponsors, venue details…"
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#CCFF00] focus:outline-none focus:ring-1 focus:ring-[#CCFF00] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRequestDialogOpen(false)}
                className="rounded-lg border border-white/10 bg-transparent px-5 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={submitRequest}
                disabled={submittingRequest}
                className="flex items-center gap-2 rounded-lg bg-[#CCFF00] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submittingRequest ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
