import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Check,
  X,
  User,
  Calendar,
  Building2,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HackathonRequest {
  id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  requested_by: string;
  requester_name: string;
  requester_email: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  num_events: number | null;
  additional_details: string | null;
  status: Status;
  admin_notes: string | null;
  status_history: string;
  created_at: string;
  updated_at: string;
}

type Status = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'changes_requested' | 'building' | 'ready';

interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  note?: string;
}

interface PaginatedRes {
  ok: boolean;
  data: HackathonRequest[];
  meta: { total: number; limit: number; offset: number; has_more: boolean };
}

interface StatsRes {
  ok: boolean;
  data: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUSES: Status[] = ['submitted', 'under_review', 'approved', 'changes_requested', 'building', 'ready', 'rejected'];
const PIPELINE: Status[] = ['submitted', 'under_review', 'approved', 'building', 'ready'];

const STATUS_COLORS: Record<Status, string> = {
  submitted: 'bg-amber-500/20 text-amber-400',
  under_review: 'bg-blue-500/20 text-blue-400',
  approved: 'bg-emerald-500/20 text-emerald-400',
  changes_requested: 'bg-orange-500/20 text-orange-400',
  building: 'bg-purple-500/20 text-purple-400',
  ready: 'bg-sky-500/20 text-sky-400',
  rejected: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS: Record<Status, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
  building: 'Building',
  ready: 'Ready',
  rejected: 'Rejected',
};

const NEXT_ACTION_LABEL: Record<string, string> = {
  submitted: 'Start Review',
  under_review: 'Approve',
  approved: 'Start Building',
  building: 'Mark as Ready',
};

const FILTER_TABS: Array<{ label: string; value: Status | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Changes Requested', value: 'changes_requested' },
  { label: 'Building', value: 'building' },
  { label: 'Ready', value: 'ready' },
  { label: 'Rejected', value: 'rejected' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

function nextStatus(current: Status): Status | null {
  const idx = PIPELINE.indexOf(current);
  if (idx === -1 || idx >= PIPELINE.length - 1) return null;
  return PIPELINE[idx + 1];
}

function parseHistory(raw: string): StatusHistoryEntry[] {
  try {
    return JSON.parse(raw) as StatusHistoryEntry[];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export function HackathonRequestsPage() {
  const [requests, setRequests] = useState<HackathonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [stats, setStats] = useState<Record<string, number>>({});
  const [statsLoading, setStatsLoading] = useState(true);

  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  /* ---------- data fetching ---------- */

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiRequest<StatsRes>('/api/v1/hackathon-requests/admin/stats');
      setStats(res.data ?? {});
    } catch {
      setStats({});
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = filter !== 'all' ? `&status=${filter}` : '';
      const res = await apiRequest<PaginatedRes>(
        `/api/v1/hackathon-requests/admin/all?limit=${limit}&offset=${offset}${statusParam}`,
      );
      setRequests(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch {
      setRequests([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset, filter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Reset offset when filter changes
  useEffect(() => {
    setOffset(0);
  }, [filter]);

  /* ---------- actions ---------- */

  const updateStatus = async (req: HackathonRequest, newStatus: Status) => {
    setUpdatingId(req.id);
    try {
      const body: { status: string; admin_notes?: string } = { status: newStatus };
      const note = adminNotes[req.id]?.trim();
      if (note) body.admin_notes = note;

      await apiRequest(`/api/v1/hackathon-requests/admin/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.success(`Request "${req.title}" updated to ${STATUS_LABELS[newStatus]}`);
      setAdminNotes((prev) => ({ ...prev, [req.id]: '' }));
      fetchRequests();
      fetchStats();
    } catch {
      toast.error('Failed to update request status');
    } finally {
      setUpdatingId(null);
    }
  };

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Hackathon Requests</h1>
        <p className="mt-1 text-sm text-white/50">
          Review and manage hackathon creation requests from organizers
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {STATUSES.map((s) => (
          <Card key={s} className="border-white/10 bg-white/5">
            <CardContent className="py-3 text-center">
              {statsLoading ? (
                <Skeleton className="mx-auto h-7 w-8" />
              ) : (
                <p className="text-xl font-bold text-white">{stats[s] ?? 0}</p>
              )}
              <Badge className={`mt-1 text-[10px] ${STATUS_COLORS[s]}`}>{STATUS_LABELS[s]}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={filter === tab.value ? 'default' : 'outline'}
            className={
              filter === tab.value
                ? 'bg-[#CCFF00] text-black hover:bg-[#b8e600] font-bold'
                : 'border-white/10 text-white/60 hover:bg-white/10'
            }
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
            {!statsLoading && tab.value !== 'all' && (
              <span className="ml-1 text-xs opacity-70">({stats[tab.value] ?? 0})</span>
            )}
          </Button>
        ))}
      </div>

      {/* Request list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`s-${String(i)}`} className="h-24 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-white/20" />
            <p className="mt-4 text-white/40">No requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isExpanded = expandedId === req.id;
            const next = nextStatus(req.status);
            const history = parseHistory(req.status_history);

            return (
              <Card key={req.id} className="border-white/10 bg-white/5 transition-all">
                {/* Collapsed card */}
                <CardContent
                  className="flex items-center gap-4 py-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    <FileText className="h-5 w-5 text-[#CCFF00]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{req.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="text-xs text-white/40 flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {req.workspace_name}
                      </span>
                      {req.description && (
                        <span className="text-xs text-white/30 truncate max-w-[200px]">
                          {req.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                    {req.starts_at && req.ends_at && (
                      <span className="text-xs text-white/40 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(req.starts_at).toLocaleDateString()} –{' '}
                        {new Date(req.ends_at).toLocaleDateString()}
                      </span>
                    )}
                    {req.num_events != null && (
                      <span className="text-xs text-white/30">{req.num_events} event{req.num_events !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={STATUS_COLORS[req.status]}>{STATUS_LABELS[req.status]}</Badge>
                    <span className="text-[10px] text-white/30">{relativeTime(req.created_at)}</span>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-white/20 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/20 shrink-0" />
                  )}
                </CardContent>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-white/10 px-6 py-5 space-y-6">
                    {/* Info grid */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Requester" value={`${req.requester_name} (${req.requester_email})`} />
                        <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Workspace" value={`${req.workspace_name} (/${req.workspace_slug})`} />
                        <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Created" value={new Date(req.created_at).toLocaleString()} />
                      </div>
                      <div className="space-y-2">
                        {req.starts_at && (
                          <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Starts" value={new Date(req.starts_at).toLocaleString()} />
                        )}
                        {req.ends_at && (
                          <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Ends" value={new Date(req.ends_at).toLocaleString()} />
                        )}
                        {req.num_events != null && (
                          <DetailRow icon={<FileText className="h-3.5 w-3.5" />} label="Events" value={String(req.num_events)} />
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {req.description && (
                      <div>
                        <p className="text-xs font-medium text-white/50 mb-1">Description</p>
                        <p className="text-sm text-white/70 whitespace-pre-wrap">{req.description}</p>
                      </div>
                    )}

                    {/* Additional details */}
                    {req.additional_details && (
                      <div>
                        <p className="text-xs font-medium text-white/50 mb-1">Additional Details</p>
                        <p className="text-sm text-white/70 whitespace-pre-wrap">{req.additional_details}</p>
                      </div>
                    )}

                    {/* Progress stepper */}
                    <div>
                      <p className="text-xs font-medium text-white/50 mb-3">Progress</p>
                      <div className="flex items-center gap-0">
                        {PIPELINE.map((step, i) => {
                          const stepIdx = PIPELINE.indexOf(step);
                          const currentIdx = (req.status === 'rejected' || req.status === 'changes_requested') ? -1 : PIPELINE.indexOf(req.status);
                          const isCompleted = currentIdx > stepIdx;
                          const isCurrent = currentIdx === stepIdx;
                          const isRejected = req.status === 'rejected';
                          const isChangesRequested = req.status === 'changes_requested';

                          return (
                            <div key={step} className="flex items-center">
                              {/* Step circle */}
                              <div className="flex flex-col items-center">
                                <div
                                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                                    isCompleted
                                      ? 'border-[#CCFF00] bg-[#CCFF00]/20 text-[#CCFF00]'
                                      : isCurrent && !isRejected && !isChangesRequested
                                        ? 'border-[#CCFF00] bg-[#CCFF00] text-black'
                                        : 'border-white/20 bg-white/5 text-white/30'
                                  }`}
                                >
                                  {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
                                </div>
                                <span
                                  className={`mt-1 text-[10px] ${
                                    isCurrent && !isRejected && !isChangesRequested ? 'text-[#CCFF00] font-bold' : isCompleted ? 'text-[#CCFF00]/60' : 'text-white/30'
                                  }`}
                                >
                                  {STATUS_LABELS[step]}
                                </span>
                              </div>

                              {/* Connector line */}
                              {i < PIPELINE.length - 1 && (
                                <div
                                  className={`h-0.5 w-6 sm:w-10 ${
                                    isCompleted ? 'bg-[#CCFF00]/40' : 'bg-white/10'
                                  }`}
                                />
                              )}
                            </div>
                          );
                        })}

                        {/* Rejected indicator */}
                        {req.status === 'rejected' && (
                          <div className="flex items-center ml-4">
                            <div className="flex flex-col items-center">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-red-500 bg-red-500/20 text-red-400">
                                <X className="h-4 w-4" />
                              </div>
                              <span className="mt-1 text-[10px] text-red-400 font-bold">Rejected</span>
                            </div>
                          </div>
                        )}

                        {/* Changes Requested indicator */}
                        {req.status === 'changes_requested' && (
                          <div className="flex items-center ml-4">
                            <div className="flex flex-col items-center">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-orange-500 bg-orange-500/20 text-orange-400">
                                <MessageSquare className="h-4 w-4" />
                              </div>
                              <span className="mt-1 text-[10px] text-orange-400 font-bold">Changes</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status history timeline */}
                    {history.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-white/50 mb-3">Status History</p>
                        <div className="space-y-2">
                          {history.map((entry, i) => (
                            <div key={`h-${String(i)}`} className="flex items-start gap-3">
                              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-white/30" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge className={STATUS_COLORS[entry.status as Status] ?? 'bg-white/10 text-white/60'}>
                                    {entry.status}
                                  </Badge>
                                  <span className="text-[10px] text-white/30">
                                    {new Date(entry.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                {entry.note && (
                                  <p className="mt-1 text-xs text-white/40">{entry.note}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Existing admin notes */}
                    {req.admin_notes && (
                      <div>
                        <p className="text-xs font-medium text-white/50 mb-1">Current Admin Notes</p>
                        <p className="text-sm text-white/60 italic whitespace-pre-wrap">{req.admin_notes}</p>
                      </div>
                    )}

                    {/* Status update controls */}
                    {req.status !== 'ready' && (
                      <Card className="border-white/10 bg-white/[0.03]">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm text-white flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-[#CCFF00]" /> Update Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <textarea
                            placeholder="Admin notes (optional, saved with status update)…"
                            value={adminNotes[req.id] ?? ''}
                            onChange={(e) =>
                              setAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#CCFF00]/40 focus:outline-none focus:ring-1 focus:ring-[#CCFF00]/20 resize-none"
                            rows={2}
                          />

                          <div className="flex flex-wrap gap-2">
                            {/* Advance button */}
                            {next && req.status !== 'rejected' && (
                              <Button
                                onClick={() => updateStatus(req, next)}
                                disabled={updatingId === req.id}
                                className="bg-[#CCFF00] text-black hover:bg-[#b8e600] font-bold"
                              >
                                {updatingId === req.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <Check className="h-4 w-4 mr-1" />
                                )}
                                {NEXT_ACTION_LABEL[req.status]}
                              </Button>
                            )}

                            {/* Reject button */}
                            {req.status !== 'rejected' && req.status !== 'changes_requested' && (
                              <Button
                                variant="outline"
                                onClick={() => updateStatus(req, 'rejected')}
                                disabled={updatingId === req.id}
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                              >
                                {updatingId === req.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <X className="h-4 w-4 mr-1" />
                                )}
                                Reject
                              </Button>
                            )}

                            {/* Request Changes button */}
                            {(req.status === 'submitted' || req.status === 'under_review') && (
                              <Button
                                variant="outline"
                                onClick={() => updateStatus(req, 'changes_requested')}
                                disabled={updatingId === req.id}
                                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
                              >
                                {updatingId === req.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                )}
                                Request Changes
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-white/40">
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="border-white/10 text-white/60"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="border-white/10 text-white/60"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tiny sub-component                                                 */
/* ------------------------------------------------------------------ */

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-white/30">{icon}</span>
      <span className="text-white/40 shrink-0">{label}:</span>
      <span className="text-white/70 break-all">{value}</span>
    </div>
  );
}
